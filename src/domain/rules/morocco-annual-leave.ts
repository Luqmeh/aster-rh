/**
 * Congé annuel payé — Loi 65-99 (Code du travail marocain), art. 231–240.
 *
 * Source officielle (Adala / Ministère de la Justice), version consolidée
 * au 26 octobre 2011 :
 * https://adala.justice.gov.ma/api/uploads/2024/04/30/code%20du%20travail-1714463246806.pdf
 *
 * Vérification documentaire : 11 novembre 2026.
 * Ne constitue pas un avis juridique. Les cas ambigus restent non postables.
 */

import { isWeekend, parseDateOnly, toDateOnly } from "@/domain/rules/dates";
import type { CalculationStatus } from "@/domain/types/entitlement";
import type { Employee, StoredContractType } from "@/domain/types/hr";

export const MA_LABOUR_CODE_SOURCE_URL =
  "https://adala.justice.gov.ma/api/uploads/2024/04/30/code%20du%20travail-1714463246806.pdf";
export const MA_LABOUR_CODE_CONSOLIDATED_DATE = "2011-10-26";
export const MA_LABOUR_CODE_VERIFICATION_DATE = "2026-11-11";

/** Art. 231 — adultes (minimum statutaire). */
export const MA_ADULT_DAYS_PER_SERVICE_MONTH = 1.5;
/** Art. 231 — moins de 18 ans (minimum statutaire). */
export const MA_MINOR_DAYS_PER_SERVICE_MONTH = 2;
/**
 * Pratique entreprise ASTER (département Maroc) : 2 j / mois de service.
 * Total d’entreprise — **pas** un complément au-dessus du 1,5 statutaire.
 * À confirmer formellement par RH avant posting Production.
 */
export const MA_COMPANY_DAYS_PER_SERVICE_MONTH = 2;
/** Art. 232 — plafond total. */
export const MA_MAX_ANNUAL_LEAVE_DAYS = 30;
/** Art. 232 — majoration par période entière de 5 ans. */
export const MA_SENIORITY_DAYS_PER_FIVE_YEARS = 1.5;
/** Art. 231 — condition d'ouverture du droit. */
export const MA_CONTINUOUS_SERVICE_MONTHS_BEFORE_ENTITLEMENT = 6;

/** Mode de taux applicable pour l’acquisition. */
export type MaAccrualRateMode = "statutory" | "company";
/** Art. 238-1. */
export const MA_EFFECTIVE_DAYS_PER_SERVICE_MONTH = 26;
/** Art. 238-2 — activités non agricoles. */
export const MA_HOURS_PER_SERVICE_MONTH_NON_AGRI = 191;
/** Art. 238-2 — activités agricoles. */
export const MA_HOURS_PER_SERVICE_MONTH_AGRI = 208;
/** Art. 240 — plancher de fractionnement (jours ouvrables incluant 2 repos). */
export const MA_SPLIT_MIN_WORKING_DAYS_INCLUDING_WEEKLY_REST = 12;

export type MaActivitySector = "non_agricole" | "agricole";

export type MaAnnualLeaveInputs = {
  employee: Employee;
  /** Fin de période d'appréciation (ISO date). */
  asOfDate: string;
  /** Début inclus de la fenêtre d'acquisition (souvent 1er du mois). */
  periodStart: string;
  /** Fin inclusive de la fenêtre. */
  periodEnd: string;
  /** Jours fériés chômés (ISO) sur la période — art. 236. */
  publicHolidayDates: string[];
  /**
   * Heures de travail effectif sur la période (si connues).
   * Prioritaire pour art. 238-2 lorsque fourni.
   */
  hoursWorkedInPeriod?: number | null;
  /** Override secteur ; défaut employee.activitySector ?? non_agricole. */
  activitySector?: MaActivitySector;
  /**
   * `company` (défaut ASTER) = 2 j/mois entreprise (total, non cumulé au 1,5).
   * `statutory` = minimum légal art. 231 uniquement.
   */
  rateMode?: MaAccrualRateMode;
};

export type MaServiceMonthBasis =
  | "full_time_hours_equivalence_art238_2"
  | "hours_worked_art238_2"
  | "effective_days_art238_1"
  | "unavailable";

export type MaAnnualLeaveCalculation = {
  /** Taux réellement appliqué (après max statutaire / entreprise). */
  ratePerServiceMonth: number;
  /** Minimum statutaire art. 231 pour la population. */
  statutoryRatePerServiceMonth: number;
  /** Taux entreprise configuré (2 j/mois) — indépendant du statutaire. */
  companyRatePerServiceMonth: number;
  rateMode: MaAccrualRateMode;
  isMinor: boolean;
  continuousServiceMonthsAtAsOf: number;
  sixMonthEligibilityMet: boolean;
  completeFiveYearPeriods: number;
  seniorityBonusDays: number;
  baseAnnualDays: number;
  /** Annuel statutaire seul (sans taux entreprise). */
  statutoryAnnualEntitlementDays: number;
  annualEntitlementDays: number;
  serviceMonthsInPeriod: number;
  serviceMonthBasis: MaServiceMonthBasis;
  periodCreditDays: number;
  calculationStatus: CalculationStatus;
  explanation: string;
  warnings: string[];
  legalReferences: string[];
};

function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = parseDateOnly(startIso).getTime();
  const end = parseDateOnly(endIso).getTime();
  if (end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** Mois calendaires complets approximés depuis l'embauche (condition art. 231). */
export function continuousServiceMonths(
  hireDate: string,
  asOfDate: string,
  departureDate: string | null,
): number {
  const end =
    departureDate && departureDate < asOfDate ? departureDate : asOfDate;
  if (end < hireDate) return 0;
  const start = parseDateOnly(hireDate);
  const finish = parseDateOnly(end);
  let months =
    (finish.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (finish.getUTCMonth() - start.getUTCMonth());
  if (finish.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function completeYearsOfService(
  hireDate: string,
  asOfDate: string,
  departureDate: string | null,
): number {
  const end =
    departureDate && departureDate < asOfDate ? departureDate : asOfDate;
  if (end < hireDate) return 0;
  const start = parseDateOnly(hireDate);
  const finish = parseDateOnly(end);
  let years = finish.getUTCFullYear() - start.getUTCFullYear();
  const beforeAnniversary =
    finish.getUTCMonth() < start.getUTCMonth() ||
    (finish.getUTCMonth() === start.getUTCMonth() &&
      finish.getUTCDate() < start.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

export function ageOnDate(
  birthDate: string | null | undefined,
  asOfDate: string,
): number | null {
  if (!birthDate) return null;
  const birth = parseDateOnly(birthDate);
  const asOf = parseDateOnly(asOfDate);
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    asOf.getUTCMonth() < birth.getUTCMonth() ||
    (asOf.getUTCMonth() === birth.getUTCMonth() &&
      asOf.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function hoursPerServiceMonth(sector: MaActivitySector): number {
  return sector === "agricole"
    ? MA_HOURS_PER_SERVICE_MONTH_AGRI
    : MA_HOURS_PER_SERVICE_MONTH_NON_AGRI;
}

/**
 * Jours de travail effectif (art. 236) : hors repos hebdomadaire (sam–dim par défaut),
 * jours de fête payés et jours fériés chômés fournis.
 */
export function countEffectiveWorkingDays(
  startIso: string,
  endIso: string,
  publicHolidayDates: string[],
): number {
  const holidays = new Set(publicHolidayDates);
  let count = 0;
  const cursor = parseDateOnly(startIso);
  const end = parseDateOnly(endIso);
  while (cursor <= end) {
    const iso = toDateOnly(cursor);
    if (!isWeekend(iso) && !holidays.has(iso)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function annualEntitlementDays(input: {
  ratePerServiceMonth: number;
  completeFiveYearPeriods: number;
}): number {
  const base = input.ratePerServiceMonth * 12;
  const seniority =
    input.completeFiveYearPeriods * MA_SENIORITY_DAYS_PER_FIVE_YEARS;
  return Math.min(MA_MAX_ANNUAL_LEAVE_DAYS, base + seniority);
}

function employmentOverlap(
  employee: Employee,
  periodStart: string,
  periodEnd: string,
): { start: string; end: string } | null {
  let start = periodStart;
  let end = periodEnd;
  if (employee.hireDate > end) return null;
  if (employee.hireDate > start) start = employee.hireDate;
  if (employee.departureDate) {
    if (employee.departureDate < start) return null;
    if (employee.departureDate < end) end = employee.departureDate;
  }
  if (end < start) return null;
  return { start, end };
}

function isFullCalendarMonthEmployment(
  employee: Employee,
  periodStart: string,
  periodEnd: string,
): boolean {
  const overlap = employmentOverlap(employee, periodStart, periodEnd);
  if (!overlap) return false;
  return overlap.start === periodStart && overlap.end === periodEnd;
}

/**
 * Calcul déterministe d'un crédit de période (souvent un mois civil).
 */
export function computeMoroccoAnnualLeaveAccrual(
  input: MaAnnualLeaveInputs,
): MaAnnualLeaveCalculation {
  const {
    employee,
    asOfDate,
    periodStart,
    periodEnd,
    publicHolidayDates,
    hoursWorkedInPeriod = null,
    rateMode = "company",
  } = input;
  const sector: MaActivitySector =
    input.activitySector ??
    (employee as Employee & { activitySector?: MaActivitySector })
      .activitySector ??
    "non_agricole";
  const warnings: string[] = [];
  const legalReferences = [
    "Loi 65-99 art. 231",
    "Loi 65-99 art. 232",
    "Loi 65-99 art. 236",
    "Loi 65-99 art. 237",
    "Loi 65-99 art. 238",
  ];

  const birthDate = (
    employee as Employee & { birthDate?: string | null }
  ).birthDate;
  const age = ageOnDate(birthDate ?? null, asOfDate);
  const isMinor = age != null && age < 18;
  if (age == null) {
    warnings.push(
      "Date de naissance absente — régime adulte statutaire (1,5 j/mois) pour le plancher légal. Renseigner birthDate pour le régime moins de 18 ans.",
    );
  }
  const statutoryRatePerServiceMonth = isMinor
    ? MA_MINOR_DAYS_PER_SERVICE_MONTH
    : MA_ADULT_DAYS_PER_SERVICE_MONTH;
  const companyRatePerServiceMonth = MA_COMPANY_DAYS_PER_SERVICE_MONTH;
  // Entreprise = total plus favorable, jamais sous le plancher statutaire ; jamais 1,5+2.
  const ratePerServiceMonth =
    rateMode === "statutory"
      ? statutoryRatePerServiceMonth
      : Math.max(companyRatePerServiceMonth, statutoryRatePerServiceMonth);

  if (rateMode === "company") {
    warnings.push(
      "Taux entreprise 2 j/mois (total ASTER) — distinct du minimum statutaire 1,5 j/mois adulte. À confirmer par RH avant posting Production.",
    );
  }

  const serviceMonthsAtAsOf = continuousServiceMonths(
    employee.hireDate,
    asOfDate,
    employee.departureDate,
  );
  const sixMonthEligibilityMet =
    serviceMonthsAtAsOf >= MA_CONTINUOUS_SERVICE_MONTHS_BEFORE_ENTITLEMENT;

  const years = completeYearsOfService(
    employee.hireDate,
    asOfDate,
    employee.departureDate,
  );
  const completeFiveYearPeriods = Math.floor(years / 5);
  const seniorityBonusDays =
    completeFiveYearPeriods * MA_SENIORITY_DAYS_PER_FIVE_YEARS;
  const baseAnnualDays = ratePerServiceMonth * 12;
  const statutoryAnnualEntitlementDays = annualEntitlementDays({
    ratePerServiceMonth: statutoryRatePerServiceMonth,
    completeFiveYearPeriods,
  });
  const annualEntitlementDaysValue = annualEntitlementDays({
    ratePerServiceMonth,
    completeFiveYearPeriods,
  });

  const overlap = employmentOverlap(employee, periodStart, periodEnd);
  if (!overlap) {
    return {
      ratePerServiceMonth,
      statutoryRatePerServiceMonth,
      companyRatePerServiceMonth,
      rateMode,
      isMinor,
      continuousServiceMonthsAtAsOf: serviceMonthsAtAsOf,
      sixMonthEligibilityMet,
      completeFiveYearPeriods,
      seniorityBonusDays,
      baseAnnualDays,
      statutoryAnnualEntitlementDays,
      annualEntitlementDays: annualEntitlementDaysValue,
      serviceMonthsInPeriod: 0,
      serviceMonthBasis: "unavailable",
      periodCreditDays: 0,
      calculationStatus: "calculated",
      explanation:
        "Hors emploi sur la période — aucun mois de service (art. 231 / 237).",
      warnings,
      legalReferences,
    };
  }

  if (employee.contractType === "cdd") {
    warnings.push(
      "CDD (art. 233) : le congé annuel doit avoir été pris avant l'expiration du contrat — suivi RH, hors formule d'acquisition.",
    );
    legalReferences.push("Loi 65-99 art. 233");
  }

  const hourThreshold = hoursPerServiceMonth(sector);
  let serviceMonthsInPeriod = 0;
  let serviceMonthBasis: MaServiceMonthBasis = "unavailable";
  let status: CalculationStatus = "calculated";

  if (hoursWorkedInPeriod != null && hoursWorkedInPeriod >= 0) {
    serviceMonthsInPeriod = hoursWorkedInPeriod / hourThreshold;
    serviceMonthBasis = "hours_worked_art238_2";
  } else if (
    isFullCalendarMonthEmployment(employee, periodStart, periodEnd) &&
    !employee.isPartTime &&
    employee.weeklyContractHours != null &&
    employee.weeklyContractHours > 0
  ) {
    const monthlyEquivalentHours = (employee.weeklyContractHours * 52) / 12;
    if (monthlyEquivalentHours + 0.5 >= hourThreshold) {
      // Temps plein non agricole ≈ 44×52/12 ≈ 190,67 h ≈ 191 h (art. 238-2).
      serviceMonthsInPeriod = 1;
      serviceMonthBasis = "full_time_hours_equivalence_art238_2";
    } else {
      serviceMonthsInPeriod = monthlyEquivalentHours / hourThreshold;
      serviceMonthBasis = "full_time_hours_equivalence_art238_2";
      warnings.push(
        `Équivalence horaire ${monthlyEquivalentHours.toFixed(2)} h/mois < ${hourThreshold} h (art. 238-2, secteur ${sector}) — mois de service fractionnaire.`,
      );
    }
  } else if (employee.isPartTime || employee.weeklyContractHours == null) {
    const effectifs = countEffectiveWorkingDays(
      overlap.start,
      overlap.end,
      publicHolidayDates,
    );
    if (
      employee.isPartTime &&
      (hoursWorkedInPeriod == null || hoursWorkedInPeriod < 0)
    ) {
      status = "requires_hr_validation";
      warnings.push(
        "Temps partiel : sans heures de travail effectif sur la période, art. 238-2 ne peut pas être appliqué de façon fiable. Fournir hoursWorkedInPeriod ou valider RH.",
      );
      serviceMonthBasis = "unavailable";
    } else if (effectifs > 0 && !employee.isPartTime) {
      serviceMonthsInPeriod = effectifs / MA_EFFECTIVE_DAYS_PER_SERVICE_MONTH;
      serviceMonthBasis = "effective_days_art238_1";
      warnings.push(
        `Conversion art. 238-1 : ${effectifs} jours de travail effectif / 26 (week-end sam–dim par défaut — à confirmer par site).`,
      );
    } else {
      status = "missing_employment_information";
      warnings.push(
        "Données insuffisantes pour mesurer le mois de service (heures ou jours de travail effectif) — art. 238.",
      );
      serviceMonthBasis = "unavailable";
    }
  } else {
    // Mois partiel d'emploi
    const effectifs = countEffectiveWorkingDays(
      overlap.start,
      overlap.end,
      publicHolidayDates,
    );
    serviceMonthsInPeriod = effectifs / MA_EFFECTIVE_DAYS_PER_SERVICE_MONTH;
    serviceMonthBasis = "effective_days_art238_1";
    warnings.push(
      `Mois partiel d'emploi : ${effectifs} jours de travail effectif / 26 (art. 238-1).`,
    );
  }

  // Crédit de période = mois de service × taux, plafonné via entitlement annuel / 12
  // pour intégrer la majoration d'ancienneté (art. 232) de façon proportionnelle.
  const monthlyFromAnnual = annualEntitlementDaysValue / 12;
  const computedCredit =
    serviceMonthBasis === "unavailable"
      ? 0
      : Math.round(serviceMonthsInPeriod * monthlyFromAnnual * 10000) / 10000;

  if (!sixMonthEligibilityMet) {
    status = "requires_hr_validation";
    warnings.push(
      `Droit au congé annuel ouvert après ${MA_CONTINUOUS_SERVICE_MONTHS_BEFORE_ENTITLEMENT} mois de service continu (art. 231). Ancienneté actuelle : ${serviceMonthsAtAsOf} mois. Crédit calculé mais non postable automatiquement.`,
    );
  }

  const postable =
    status === "calculated" &&
    sixMonthEligibilityMet &&
    computedCredit > 0;

  const explanation = [
    `CAP Maroc : crédit période ${computedCredit} j (${serviceMonthsInPeriod.toFixed(4)} mois de service × ${monthlyFromAnnual.toFixed(4)} j ; annuel plafonné ${annualEntitlementDaysValue} j dont ancienneté art. 232 = ${seniorityBonusDays} j).`,
    `Mode ${rateMode} : applicable ${ratePerServiceMonth} j/mois (statutaire ${statutoryRatePerServiceMonth} ; entreprise ${companyRatePerServiceMonth} — non cumulés).`,
    `Annuel statutaire seul : ${statutoryAnnualEntitlementDays} j.`,
    `Postable auto (moteur) : ${postable ? "oui" : "non"} — posting Production soumis à confirmation RH de la politique applicable.`,
    `Population : ${isMinor ? "moins de 18 ans" : "adulte"}.`,
    `Base de mesure : ${serviceMonthBasis}.`,
    `Éligibilité 6 mois : ${sixMonthEligibilityMet ? "oui" : "non"} (${serviceMonthsAtAsOf} mois).`,
  ].join(" ");

  return {
    ratePerServiceMonth,
    statutoryRatePerServiceMonth,
    companyRatePerServiceMonth,
    rateMode,
    isMinor,
    continuousServiceMonthsAtAsOf: serviceMonthsAtAsOf,
    sixMonthEligibilityMet,
    completeFiveYearPeriods,
    seniorityBonusDays,
    baseAnnualDays,
    statutoryAnnualEntitlementDays,
    annualEntitlementDays: annualEntitlementDaysValue,
    serviceMonthsInPeriod:
      Math.round(serviceMonthsInPeriod * 10000) / 10000,
    serviceMonthBasis,
    /** Quantité proposée (0 si données insuffisantes). Le posting n'accepte que status=calculated. */
    periodCreditDays: computedCredit,
    calculationStatus: status,
    explanation,
    warnings,
    legalReferences: [...new Set(legalReferences)],
  };
}

/** Art. 240 — report / fractionnement par accord uniquement. */
export function assertMaCarryoverAgreement(input: {
  hasMutualAgreement: boolean;
  spansAtMostTwoConsecutiveYears: boolean;
}): { ok: boolean; reason: string } {
  if (!input.hasMutualAgreement) {
    return {
      ok: false,
      reason:
        "Art. 240 : fractionnement ou cumul sur deux années consécutives uniquement après accord salarié–employeur (mention au registre des congés).",
    };
  }
  if (!input.spansAtMostTwoConsecutiveYears) {
    return {
      ok: false,
      reason:
        "Art. 240 : le cumul légal vise deux années consécutives — au-delà, validation juridique / politique interne requise.",
    };
  }
  return {
    ok: true,
    reason:
      "Art. 240 : accord mutuel pour fractionner ou cumuler sur deux années consécutives. Pas d'expiry automatique statutaire configurée.",
  };
}

export function isAnnualLeaveContractEligible(
  contractType: StoredContractType,
): boolean {
  return (
    contractType === "cdi" ||
    contractType === "cdd" ||
    contractType === "alternance" ||
    contractType === "stage"
  );
}

export function monthsInPeriodLabel(start: string, end: string): string {
  return `${start}→${end} (${daysBetweenInclusive(start, end)} j civils)`;
}
