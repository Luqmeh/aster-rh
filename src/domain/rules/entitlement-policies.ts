/**
 * Politiques d'acquisition ASTER — département Maroc.
 *
 * Les politiques FR (guide PKF France p.38–48) sont conservées en historique
 * désactivé (`jurisdiction=FR`, `isActive=false`) pour comprendre d’anciennes
 * métadonnées ledger. Elles ne sont jamais utilisées pour preview/post Maroc.
 *
 * Voir docs/MOROCCO_HR_POLICY.md.
 */

import type {
  EntitlementPolicyVersion,
  RoundingMode,
} from "@/domain/types/entitlement";

const GUIDE_FR_REF =
  "HISTORIQUE — Guide RH PKF Arsilon France nov. 2026 p.38–48 (non applicable Maroc)";
const MA_LABOUR_REF =
  "Loi 65-99 art. 231–240 — Adala justice.gov.ma PDF consolidé 26/10/2011 (vérif. 2026-11-11)";

/** @deprecated Valeurs FR — ne plus utiliser pour le Maroc. */
export const CP_MONTHLY_ACCRUAL_DAYS = 2.08;
export const CP_CARRYOVER_MAX_DAYS = 5;
export const RTT_NON_CADRE_ANNUAL_DAYS = 11;
export const RTT_CADRE_MIN_DAYS = 7;
export const RTT_CADRE_MAX_DAYS = 11;
export const RTT_MAX_NEGATIVE_DAYS = 6;

/** Art. 231 adultes — 1,5 j de travail effectif / mois de service (minimum statutaire). */
export const MA_ANNUAL_LEAVE_DAYS_PER_MONTH_STATUTORY = 1.5;
export const MA_ANNUAL_LEAVE_DAYS_PER_YEAR_STATUTORY = 18;
/** Pratique entreprise ASTER : 2 j/mois = total (pas un complément au 1,5). */
export const MA_ANNUAL_LEAVE_DAYS_PER_MONTH_COMPANY = 2;
export const MA_ANNUAL_LEAVE_DAYS_PER_YEAR_COMPANY = 24;
/** @deprecated alias — préférer STATUTORY / COMPANY. */
export const MA_ANNUAL_LEAVE_DAYS_PER_MONTH_PROPOSED =
  MA_ANNUAL_LEAVE_DAYS_PER_MONTH_STATUTORY;
export const MA_ANNUAL_LEAVE_DAYS_PER_YEAR_PROPOSED =
  MA_ANNUAL_LEAVE_DAYS_PER_YEAR_STATUTORY;

export function defaultCpRoundingMode(): RoundingMode {
  return "none";
}

function deactivateFr(
  policy: EntitlementPolicyVersion,
): EntitlementPolicyVersion {
  return {
    ...policy,
    jurisdiction: "FR",
    isActive: false,
    effectiveTo: policy.effectiveTo ?? "2026-11-10",
    validationStatus: "draft",
    notes: `${policy.notes ?? ""} [DÉSACTIVÉ Maroc — historique FR]`.trim(),
  };
}

/** Politiques seed : FR désactivées + CAP Maroc non auto. */
export function seedEntitlementPolicyVersions(
  nowIso = "2026-11-11T00:00:00.000Z",
): EntitlementPolicyVersion[] {
  const frHistorical = ([
    {
      id: "epv-cp-v1",
      policyId: "ep-cp",
      policyCode: "CP_ACQUISITION_JUN_MAY",
      kind: "conges_payes",
      version: 1,
      effectiveFrom: "2025-06-01",
      effectiveTo: "2026-11-10",
      validationStatus: "draft",
      jurisdiction: "FR",
      isActive: false,
      sourceReference: GUIDE_FR_REF,
      notes:
        "HISTORIQUE FR — 2,08 j/mois juin–mai. Non applicable au département Maroc.",
      rules: {
        eligibleContractTypes: ["cdi", "cdd", "alternance"],
        eligibleCategories: null,
        acquisitionPeriod: {
          startMonth: 6,
          startDay: 1,
          endMonth: 5,
          endDay: 31,
        },
        monthlyAccrualDays: CP_MONTHLY_ACCRUAL_DAYS,
        annualEntitlementDays: 25,
        ledgerAccount: "conges_payes_en_acquisition",
        unit: "days",
        allowHalfDay: true,
        rounding: {
          mode: defaultCpRoundingMode(),
          notes: "Exemple FR 10,4→11 — non généralisé.",
        },
        carryover: {
          maxDays: CP_CARRYOVER_MAX_DAYS,
          cumulative: false,
          requiresApprovalAboveMax: true,
        },
        partTimeRequiresHrValidation: true,
      },
      createdByEmployeeId: null,
      createdAt: nowIso,
    },
    {
      id: "epv-rtt-noncadre-v1",
      policyId: "ep-rtt-noncadre",
      policyCode: "RTT_NON_CADRE_JUL_JUN",
      kind: "rtt",
      version: 1,
      effectiveFrom: "2025-07-01",
      effectiveTo: "2026-11-10",
      validationStatus: "draft",
      jurisdiction: "FR",
      isActive: false,
      sourceReference: GUIDE_FR_REF,
      notes: "HISTORIQUE FR — RTT non-cadre. Pas de RTT statutaire Maroc auto.",
      rules: {
        eligibleContractTypes: ["cdi", "cdd"],
        eligibleCategories: ["non_cadre"],
        acquisitionPeriod: {
          startMonth: 7,
          startDay: 1,
          endMonth: 6,
          endDay: 30,
        },
        annualEntitlementDays: RTT_NON_CADRE_ANNUAL_DAYS,
        ledgerAccount: "rtt",
        unit: "days",
        allowHalfDay: true,
        rounding: { mode: "none", notes: "" },
        expiry: { onMonth: 7, onDay: 1, noCarryover: true },
        requiresOfficeCalendar: false,
      },
      createdByEmployeeId: null,
      createdAt: nowIso,
    },
    {
      id: "epv-rtt-cadre-v1",
      policyId: "ep-rtt-cadre",
      policyCode: "RTT_CADRE_JUL_JUN",
      kind: "rtt",
      version: 1,
      effectiveFrom: "2025-07-01",
      effectiveTo: "2026-11-10",
      validationStatus: "draft",
      jurisdiction: "FR",
      isActive: false,
      sourceReference: GUIDE_FR_REF,
      notes: "HISTORIQUE FR — RTT cadre. Désactivé Maroc.",
      rules: {
        eligibleContractTypes: ["cdi", "cdd"],
        eligibleCategories: ["cadre"],
        acquisitionPeriod: {
          startMonth: 7,
          startDay: 1,
          endMonth: 6,
          endDay: 30,
        },
        ledgerAccount: "rtt",
        unit: "days",
        allowHalfDay: true,
        rounding: { mode: "none", notes: "" },
        requiresOfficeCalendar: true,
      },
      createdByEmployeeId: null,
      createdAt: nowIso,
    },
    {
      id: "epv-carryover-cp-v1",
      policyId: "ep-carryover-cp",
      policyCode: "CP_CARRYOVER",
      kind: "carryover_cp",
      version: 1,
      effectiveFrom: "2025-06-01",
      effectiveTo: "2026-11-10",
      validationStatus: "draft",
      jurisdiction: "FR",
      isActive: false,
      sourceReference: GUIDE_FR_REF,
      notes: "HISTORIQUE FR — report 5 j. Report MA à définir.",
      rules: {
        eligibleContractTypes: ["cdi", "cdd", "alternance"],
        eligibleCategories: null,
        acquisitionPeriod: {
          startMonth: 6,
          startDay: 1,
          endMonth: 5,
          endDay: 31,
        },
        ledgerAccount: "conges_payes_acquis",
        unit: "days",
        allowHalfDay: true,
        rounding: { mode: "none", notes: "" },
        carryover: {
          maxDays: CP_CARRYOVER_MAX_DAYS,
          cumulative: false,
          requiresApprovalAboveMax: true,
        },
      },
      createdByEmployeeId: null,
      createdAt: nowIso,
    },
    {
      id: "epv-expiry-rtt-v1",
      policyId: "ep-expiry-rtt",
      policyCode: "RTT_EXPIRY_JULY_1",
      kind: "expiry_rtt",
      version: 1,
      effectiveFrom: "2025-07-01",
      effectiveTo: "2026-11-10",
      validationStatus: "draft",
      jurisdiction: "FR",
      isActive: false,
      sourceReference: GUIDE_FR_REF,
      notes: "HISTORIQUE FR — expiry RTT 1er juillet.",
      rules: {
        eligibleContractTypes: ["cdi", "cdd"],
        eligibleCategories: null,
        acquisitionPeriod: {
          startMonth: 7,
          startDay: 1,
          endMonth: 6,
          endDay: 30,
        },
        ledgerAccount: "rtt",
        unit: "days",
        allowHalfDay: true,
        rounding: { mode: "none", notes: "" },
        expiry: { onMonth: 7, onDay: 1, noCarryover: true },
      },
      createdByEmployeeId: null,
      createdAt: nowIso,
    },
  ] as EntitlementPolicyVersion[]).map(deactivateFr);

  const maStatutory: EntitlementPolicyVersion = {
    id: "epv-ma-annual-v1",
    policyId: "ep-ma-annual",
    policyCode: "MA_ANNUAL_LEAVE_STATUTORY",
    kind: "conges_payes",
    version: 1,
    effectiveFrom: "2004-05-06",
    effectiveTo: null,
    validationStatus: "guide_documented",
    jurisdiction: "MA",
    isActive: true,
    sourceReference: MA_LABOUR_REF,
    notes:
      "Référence statutaire art. 231–238 : 1,5 j (adulte) / 2 j (<18) / mois de service ; +1,5 j / 5 ans max 30. Non utilisée comme droit applicable ASTER lorsque la politique entreprise est active. Pas de posting auto (hr_configured requis).",
    rules: {
      eligibleContractTypes: ["cdi", "cdd", "alternance"],
      eligibleCategories: null,
      acquisitionPeriod: {
        startMonth: 1,
        startDay: 1,
        endMonth: 12,
        endDay: 31,
      },
      monthlyAccrualDays: MA_ANNUAL_LEAVE_DAYS_PER_MONTH_STATUTORY,
      annualEntitlementDays: MA_ANNUAL_LEAVE_DAYS_PER_YEAR_STATUTORY,
      ledgerAccount: "conges_payes_en_acquisition",
      unit: "days",
      allowHalfDay: true,
      rounding: {
        mode: "none",
        notes: "Pas d'arrondi statutaire spécifique — décimales conservées.",
      },
      partTimeRequiresHrValidation: true,
      carryover: {
        maxDays: 30,
        cumulative: true,
        requiresApprovalAboveMax: true,
      },
    },
    createdByEmployeeId: null,
    createdAt: nowIso,
  };

  const maCompany: EntitlementPolicyVersion = {
    id: "epv-ma-annual-company-v1",
    policyId: "ep-ma-annual-company",
    policyCode: "MA_ANNUAL_LEAVE_COMPANY",
    kind: "conges_payes",
    version: 1,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    validationStatus: "requires_hr_decision",
    jurisdiction: "MA",
    isActive: true,
    sourceReference:
      "Pratique entreprise communiquée pour ASTER (département Maroc) — 2 j/mois total ; source formelle RH à confirmer",
    notes:
      "Droit applicable ASTER : 2 j/mois de service (24 j/an de base) = total entreprise, distinct et non cumulé avec 1,5 statutaire. Ancienneté art. 232 (+1,5/5 ans, max 30) appliquée sur cette base tant que RH n’indique pas autrement. Preview autorisée ; posting auto uniquement après hr_configured.",
    rules: {
      eligibleContractTypes: ["cdi", "cdd", "alternance"],
      eligibleCategories: null,
      acquisitionPeriod: {
        startMonth: 1,
        startDay: 1,
        endMonth: 12,
        endDay: 31,
      },
      monthlyAccrualDays: MA_ANNUAL_LEAVE_DAYS_PER_MONTH_COMPANY,
      annualEntitlementDays: MA_ANNUAL_LEAVE_DAYS_PER_YEAR_COMPANY,
      ledgerAccount: "conges_payes_en_acquisition",
      unit: "days",
      allowHalfDay: true,
      rounding: {
        mode: "none",
        notes: "Décimales conservées.",
      },
      partTimeRequiresHrValidation: true,
      carryover: {
        maxDays: 30,
        cumulative: true,
        requiresApprovalAboveMax: true,
      },
    },
    createdByEmployeeId: null,
    createdAt: nowIso,
  };

  return [...frHistorical, maStatutory, maCompany];
}

/** Politique CAP applicable : entreprise prioritaire si active. */
export function selectApplicableCpPolicy(
  versions: EntitlementPolicyVersion[],
  asOfDate: string,
): EntitlementPolicyVersion | undefined {
  const active = selectActiveMoroccoPolicies(versions, asOfDate).filter(
    (p) => p.kind === "conges_payes",
  );
  return (
    active.find((p) => p.policyCode === "MA_ANNUAL_LEAVE_COMPANY") ??
    active.find((p) => p.policyCode === "MA_ANNUAL_LEAVE_STATUTORY")
  );
}

/** Politiques actives pour le moteur Maroc (exclut FR et inactives). */
export function selectActiveMoroccoPolicies(
  versions: EntitlementPolicyVersion[],
  asOfDate: string,
): EntitlementPolicyVersion[] {
  return versions.filter((v) => {
    if (!v.isActive) return false;
    if (v.jurisdiction === "FR") return false;
    if (v.effectiveFrom > asOfDate) return false;
    if (v.effectiveTo && v.effectiveTo < asOfDate) return false;
    return true;
  });
}

export function selectPolicyVersionsForDate(
  versions: EntitlementPolicyVersion[],
  asOfDate: string,
): EntitlementPolicyVersion[] {
  return selectActiveMoroccoPolicies(versions, asOfDate);
}

/**
 * Posting auto Production uniquement après confirmation RH explicite.
 * `guide_documented` / `requires_hr_decision` → preview seulement.
 */
export function isPolicyAutoPostable(v: EntitlementPolicyVersion): boolean {
  return (
    v.isActive &&
    v.jurisdiction === "MA" &&
    v.validationStatus === "hr_configured"
  );
}
