/**
 * Moteur d'acquisition déterministe (preview) — Phase 2.
 * Ne poste pas au ledger ; le service d'application gère preview → post.
 */

import { MOROCCO_LEGAL_WEEKLY_HOURS_REFERENCE } from "@/domain/config/aster-locale";
import {
  isPolicyAutoPostable,
  MA_ANNUAL_LEAVE_DAYS_PER_MONTH_PROPOSED,
  RTT_CADRE_MAX_DAYS,
  RTT_CADRE_MIN_DAYS,
  selectPolicyVersionsForDate,
} from "@/domain/rules/entitlement-policies";
import type {
  AccrualPreviewLine,
  CalculationStatus,
  EntitlementPolicyVersion,
  OfficeWorkCalendar,
} from "@/domain/types/entitlement";
import type { Employee } from "@/domain/types/hr";

export type MonthlyPeriod = {
  /** Clé stable : YYYY-MM */
  periodKey: string;
  year: number;
  month: number;
  /** Premier jour du mois (ISO). */
  monthStart: string;
  /** Dernier jour du mois (ISO). */
  monthEnd: string;
};

export function buildMonthlyPeriod(year: number, month: number): MonthlyPeriod {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return {
    periodKey: `${year}-${String(month).padStart(2, "0")}`,
    year,
    month,
    monthStart,
    monthEnd,
  };
}

/** Période CP juin N → mai N+1 contenant la date. */
export function cpAcquisitionPeriodContaining(dateIso: string): {
  periodKey: string;
  start: string;
  end: string;
} {
  const y = Number(dateIso.slice(0, 4));
  const m = Number(dateIso.slice(5, 7));
  if (m >= 6) {
    return {
      periodKey: `CP:${y}-${y + 1}`,
      start: `${y}-06-01`,
      end: `${y + 1}-05-31`,
    };
  }
  return {
    periodKey: `CP:${y - 1}-${y}`,
    start: `${y - 1}-06-01`,
    end: `${y}-05-31`,
  };
}

/** Période RTT juillet N → juin N+1. */
export function rttAcquisitionPeriodContaining(dateIso: string): {
  periodKey: string;
  start: string;
  end: string;
} {
  const y = Number(dateIso.slice(0, 4));
  const m = Number(dateIso.slice(5, 7));
  if (m >= 7) {
    return {
      periodKey: `RTT:${y}-${y + 1}`,
      start: `${y}-07-01`,
      end: `${y + 1}-06-30`,
    };
  }
  return {
    periodKey: `RTT:${y - 1}-${y}`,
    start: `${y - 1}-07-01`,
    end: `${y}-06-30`,
  };
}

function isEmployedOn(employee: Employee, dateIso: string): boolean {
  if (employee.hireDate > dateIso) return false;
  if (employee.departureDate && employee.departureDate < dateIso) return false;
  if (employee.employmentStatus === "parti" && employee.departureDate) {
    return employee.departureDate >= dateIso;
  }
  return true;
}

/** Mois civil entier dans l'emploi (sans inventer de prorata intra-mois). */
export function isFullMonthEmployed(
  employee: Employee,
  period: MonthlyPeriod,
): boolean {
  if (!isEmployedOn(employee, period.monthStart)) return false;
  if (!isEmployedOn(employee, period.monthEnd)) return false;
  return true;
}

export function isAlternant(employee: Employee): boolean {
  return employee.contractType === "alternance";
}

export function isCpEligible(employee: Employee): boolean {
  return (
    employee.contractType === "cdi" ||
    employee.contractType === "cdd" ||
    employee.contractType === "alternance"
  );
}

export function isRttEligible(employee: Employee): boolean {
  if (isAlternant(employee)) return false;
  return employee.contractType === "cdi" || employee.contractType === "cdd";
}

export function accrualIdempotencyKey(input: {
  employeeId: string;
  account: string;
  periodKey: string;
  policyCode: string;
}): string {
  return `accrual:${input.employeeId}:${input.account}:${input.periodKey}:${input.policyCode}`;
}

/**
 * Arrondi fin de période CP — uniquement si mode configuré.
 * Exemple guide 10,4 → 11 : ceil si fractionnelle (opt-in).
 */
export function applyCpEndOfPeriodRounding(
  quantity: number,
  mode: EntitlementPolicyVersion["rules"]["rounding"]["mode"],
): number {
  if (mode === "none") return quantity;
  if (mode === "end_of_period_example_ceil_half") {
    const whole = Math.floor(quantity);
    const frac = quantity - whole;
    if (frac === 0) return quantity;
    return whole + 1;
  }
  return quantity;
}

export function computeCadreRttEntitlement(
  calendar: OfficeWorkCalendar | null,
): {
  days: number | null;
  status: CalculationStatus;
  warnings: string[];
} {
  if (!calendar) {
    return {
      days: null,
      status: "missing_policy_configuration",
      warnings: [
        "RTT cadre : calendrier de bureau manquant — calcul 7–11 j impossible (guide p.38–48).",
      ],
    };
  }
  if (
    calendar.validationStatus !== "hr_configured" &&
    calendar.validationStatus !== "guide_documented"
  ) {
    return {
      days: null,
      status: "requires_hr_validation",
      warnings: [
        `Calendrier « ${calendar.code} » non validé (statut ${calendar.validationStatus}).`,
      ],
    };
  }
  const workingHolidayCount = calendar.workingHolidays.length;
  // Formule : base max 11 moins jours fériés ouvrés, plancher 7 — paramétrage HR-configured.
  const raw = RTT_CADRE_MAX_DAYS - workingHolidayCount;
  const days = Math.min(
    RTT_CADRE_MAX_DAYS,
    Math.max(RTT_CADRE_MIN_DAYS, raw),
  );
  return {
    days,
    status: "calculated",
    warnings: [
      `RTT cadre calculé : ${days} j (max ${RTT_CADRE_MAX_DAYS} − ${workingHolidayCount} férié(s) ouvré(s), plancher ${RTT_CADRE_MIN_DAYS}) — calendrier ${calendar.code}.`,
    ],
  };
}

export function assessPartTimeCp(
  employee: Employee,
): { status: CalculationStatus; warnings: string[] } {
  const isPartTime =
    "isPartTime" in employee &&
    Boolean((employee as Employee & { isPartTime?: boolean }).isPartTime);
  const weekly = (employee as Employee & { weeklyContractHours?: number | null })
    .weeklyContractHours;
  if (!isPartTime) {
    if (
      weekly != null &&
      weekly > 0 &&
      weekly !== MOROCCO_LEGAL_WEEKLY_HOURS_REFERENCE
    ) {
      return {
        status: "requires_hr_validation",
        warnings: [
          `Horaires contractuels ${weekly} h/sem ≠ référence ${MOROCCO_LEGAL_WEEKLY_HOURS_REFERENCE} h (durée légale couramment citée) — À valider par RH ; pas de formule inventée.`,
        ],
      };
    }
    return { status: "calculated", warnings: [] };
  }
  return {
    status: "requires_hr_validation",
    warnings: [
      "Temps partiel : le guide renvoie aux dispositions applicables — durée d'absence en jours travaillés selon planning. Pas de multiplication silencieuse du droit CP. Validation RH requise.",
    ],
  };
}

export function previewMonthlyCpAccrual(input: {
  employee: Employee;
  period: MonthlyPeriod;
  policies: EntitlementPolicyVersion[];
}): AccrualPreviewLine | null {
  const { employee, period, policies } = input;
  const asOf = period.monthEnd;
  const active = selectPolicyVersionsForDate(policies, asOf).find(
    (p) =>
      p.kind === "conges_payes" &&
      (p.policyCode === "MA_ANNUAL_LEAVE_STATUTORY" ||
        p.policyCode === "CP_ACQUISITION_JUN_MAY"),
  );

  if (!isCpEligible(employee)) {
    return {
      employeeId: employee.id,
      account: "conges_payes_en_acquisition",
      policyVersionId: active?.id ?? null,
      policyCode: active?.policyCode ?? null,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "ineligible",
      explanation: `Contrat ${employee.contractType} hors population CP (CDI/CDD/alternance — guide p.38–48).`,
      warnings: [],
      idempotencyKey: accrualIdempotencyKey({
        employeeId: employee.id,
        account: "conges_payes_en_acquisition",
        periodKey: period.periodKey,
        policyCode: active?.policyCode ?? "MA_ANNUAL_LEAVE_STATUTORY",
      }),
    };
  }

  if (!active) {
    return {
      employeeId: employee.id,
      account: "conges_payes_en_acquisition",
      policyVersionId: null,
      policyCode: null,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "missing_policy_configuration",
      explanation:
        "Aucune politique de congé annuel Maroc active — À valider par RH.",
      warnings: ["Politique MA manquante ou politiques FR désactivées."],
      idempotencyKey: accrualIdempotencyKey({
        employeeId: employee.id,
        account: "conges_payes_en_acquisition",
        periodKey: period.periodKey,
        policyCode: "MA_ANNUAL_LEAVE_STATUTORY",
      }),
    };
  }

  if (!employee.hireDate) {
    return {
      employeeId: employee.id,
      account: "conges_payes_en_acquisition",
      policyVersionId: active.id,
      policyCode: active.policyCode,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "missing_employment_information",
      explanation: "Date d'embauche manquante.",
      warnings: ["hireDate manquant."],
      idempotencyKey: accrualIdempotencyKey({
        employeeId: employee.id,
        account: "conges_payes_en_acquisition",
        periodKey: period.periodKey,
        policyCode: active.policyCode,
      }),
    };
  }

  const partTime = assessPartTimeCp(employee);
  const warnings = [...partTime.warnings];

  if (!isFullMonthEmployed(employee, period)) {
    const partialOutside =
      employee.hireDate > period.monthEnd ||
      (employee.departureDate != null &&
        employee.departureDate < period.monthStart);
    if (partialOutside) {
      return {
        employeeId: employee.id,
        account: "conges_payes_en_acquisition",
        policyVersionId: active.id,
        policyCode: active.policyCode,
        periodKey: period.periodKey,
        quantity: 0,
        calculationStatus: "calculated",
        explanation:
          "Hors emploi sur ce mois civil — aucun crédit CP (pas d'acquisition hors période d'emploi).",
        warnings,
        idempotencyKey: accrualIdempotencyKey({
          employeeId: employee.id,
          account: "conges_payes_en_acquisition",
          periodKey: period.periodKey,
          policyCode: active.policyCode,
        }),
      };
    }
    return {
      employeeId: employee.id,
      account: "conges_payes_en_acquisition",
      policyVersionId: active.id,
      policyCode: active.policyCode,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "requires_hr_validation",
      explanation:
        "Mois partiel d'emploi : le guide ne détaille pas le prorata intra-mois ici — règle RH approuvée requise (pas de formule inventée).",
      warnings: [
        ...warnings,
        "Entrée/sortie en cours de mois — validation RH.",
      ],
      idempotencyKey: accrualIdempotencyKey({
        employeeId: employee.id,
        account: "conges_payes_en_acquisition",
        periodKey: period.periodKey,
        policyCode: active.policyCode,
      }),
    };
  }

  const rate =
    active.rules.monthlyAccrualDays ?? MA_ANNUAL_LEAVE_DAYS_PER_MONTH_PROPOSED;
  const postable = isPolicyAutoPostable(active);
  let status: CalculationStatus =
    partTime.status === "calculated" ? "calculated" : partTime.status;
  if (!postable) {
    status = "requires_hr_validation";
    warnings.push(
      "Politique Maroc non hr_configured — aucun crédit auto (À valider par RH).",
    );
  }

  return {
    employeeId: employee.id,
    account: "conges_payes_en_acquisition",
    policyVersionId: active.id,
    policyCode: active.policyCode,
    periodKey: period.periodKey,
    quantity: status === "calculated" && postable ? rate : 0,
    calculationStatus: status,
    explanation:
      status === "calculated" && postable
        ? `Acquisition congé annuel ${rate} j pour mois plein ${period.periodKey} (politique MA validée).`
        : `Congé annuel Maroc : calcul non postable (${status}). Baseline proposée ${rate} j/mois — validation RH requise.`,
    warnings,
    idempotencyKey: accrualIdempotencyKey({
      employeeId: employee.id,
      account: "conges_payes_en_acquisition",
      periodKey: period.periodKey,
      policyCode: active.policyCode,
    }),
  };
}

/**
 * RTT : pas de droit statutaire Maroc automatique.
 * Les politiques FR sont désactivées ; sans politique MA hr_configured → pas de crédit.
 * Le paramètre cadre/non-cadre n’est plus un déterminant d’acquisition.
 */
export function previewMonthlyRttAccrual(input: {
  employee: Employee;
  period: MonthlyPeriod;
  policies: EntitlementPolicyVersion[];
  officeCalendar: OfficeWorkCalendar | null;
}): AccrualPreviewLine | null {
  const { employee, period, policies, officeCalendar } = input;
  const asOf = period.monthEnd;
  const active = selectPolicyVersionsForDate(policies, asOf).find(
    (p) => p.kind === "rtt" && isPolicyAutoPostable(p),
  );

  const baseKey = accrualIdempotencyKey({
    employeeId: employee.id,
    account: "rtt",
    periodKey: period.periodKey,
    policyCode: active?.policyCode ?? "MA_RTT_NONE",
  });

  if (!active) {
    return {
      employeeId: employee.id,
      account: "rtt",
      policyVersionId: null,
      policyCode: null,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "missing_policy_configuration",
      explanation:
        "Aucun RTT statutaire Maroc configuré. Les politiques FR sont désactivées. Solde RTT historique éventuel conservé au ledger.",
      warnings: [
        "Pas d’acquisition RTT automatique — À valider par RH si avantage employeur.",
      ],
      idempotencyKey: baseKey,
    };
  }

  if (!isRttEligible(employee)) {
    return {
      employeeId: employee.id,
      account: "rtt",
      policyVersionId: active.id,
      policyCode: active.policyCode,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "ineligible",
      explanation: isAlternant(employee)
        ? "Alternant : hors population RTT employeur (si configurée)."
        : `Contrat ${employee.contractType} non éligible RTT employeur.`,
      warnings: [],
      idempotencyKey: baseKey,
    };
  }

  // Calendrier bureau uniquement si la politique MA active l’exige (pas via cadre).
  if (active.rules.requiresOfficeCalendar && !officeCalendar) {
    return {
      employeeId: employee.id,
      account: "rtt",
      policyVersionId: active.id,
      policyCode: active.policyCode,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "missing_policy_configuration",
      explanation: "Calendrier de bureau requis par la politique employeur.",
      warnings: [],
      idempotencyKey: baseKey,
    };
  }

  if (!isFullMonthEmployed(employee, period)) {
    const outside =
      employee.hireDate > period.monthEnd ||
      (employee.departureDate != null &&
        employee.departureDate < period.monthStart);
    if (outside) {
      return {
        employeeId: employee.id,
        account: "rtt",
        policyVersionId: active.id,
        policyCode: active.policyCode,
        periodKey: period.periodKey,
        quantity: 0,
        calculationStatus: "calculated",
        explanation: "Hors emploi sur ce mois — aucun crédit RTT.",
        warnings: [],
        idempotencyKey: baseKey,
      };
    }
    return {
      employeeId: employee.id,
      account: "rtt",
      policyVersionId: active.id,
      policyCode: active.policyCode,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "requires_hr_validation",
      explanation:
        "Mois partiel RTT : pas de prorata inventé — validation RH requise.",
      warnings: ["Entrée/sortie en cours de mois."],
      idempotencyKey: baseKey,
    };
  }

  const annual = active.rules.annualEntitlementDays;
  if (annual == null || annual <= 0) {
    return {
      employeeId: employee.id,
      account: "rtt",
      policyVersionId: active.id,
      policyCode: active.policyCode,
      periodKey: period.periodKey,
      quantity: 0,
      calculationStatus: "requires_hr_validation",
      explanation:
        "Politique RTT employeur sans quantum annuel — À valider par RH.",
      warnings: [],
      idempotencyKey: baseKey,
    };
  }

  const monthly = Math.round((annual / 12) * 10000) / 10000;
  void officeCalendar;

  return {
    employeeId: employee.id,
    account: "rtt",
    policyVersionId: active.id,
    policyCode: active.policyCode,
    periodKey: period.periodKey,
    quantity: monthly,
    calculationStatus: "calculated",
    explanation: `Acquisition RTT employeur mensuelle ${monthly} j (${annual} j / 12) — politique MA hr_configured.`,
    warnings: [],
    idempotencyKey: baseKey,
  };
}

export function rttUsageTargetDays(
  projectedAnnual: number,
  percent: number,
): number {
  return Math.round(projectedAnnual * (percent / 100) * 10000) / 10000;
}

export function assertCarryoverWithinPolicy(input: {
  requestedDays: number;
  maxDays: number;
  hasPartnerApproval: boolean;
  hasLeavePlanThroughDec31: boolean;
}): { ok: boolean; requiresException: boolean; reason: string } {
  if (input.requestedDays <= 0) {
    return { ok: false, requiresException: false, reason: "Quantité invalide." };
  }
  if (input.requestedDays <= input.maxDays) {
    return {
      ok: true,
      requiresException: false,
      reason: `Report dans la limite de ${input.maxDays} j (non cumulable).`,
    };
  }
  if (input.hasPartnerApproval && input.hasLeavePlanThroughDec31) {
    return {
      ok: true,
      requiresException: true,
      reason:
        "Report exceptionnel avec validation partenaire + plan jusqu'au 31/12 — à transmettre RRH (règle employeur à confirmer Maroc).",
    };
  }
  return {
    ok: false,
    requiresException: true,
    reason:
      "Au-delà du plafond configuré : exception non auto-approuvée — validation RH Maroc requise.",
  };
}
