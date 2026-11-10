/**
 * Politiques d'acquisition ASTER — source : Guide des pratiques RH PKF Arsilon
 * novembre 2026, pages 38–48 (sauf mentions explicites).
 *
 * Ne pas inventer de formules statutaires. Les règles non confirmées restent
 * `requires_hr_decision` / `draft`.
 */

import type {
  EntitlementPolicyVersion,
  RoundingMode,
} from "@/domain/types/entitlement";

const GUIDE_REF = "Guide RH PKF Arsilon nov. 2026, p.38–48";

export const CP_MONTHLY_ACCRUAL_DAYS = 2.08;
export const CP_WEEKS_ANNUAL = 5;
export const CP_CARRYOVER_MAX_DAYS = 5;
export const RTT_NON_CADRE_ANNUAL_DAYS = 11;
export const RTT_CADRE_MIN_DAYS = 7;
export const RTT_CADRE_MAX_DAYS = 11;
export const RTT_MAX_NEGATIVE_DAYS = 6;
/** Arrangement horaire de référence cité pour orientation RH (pas une formule auto). */
export const STANDARD_WEEKLY_HOURS_REFERENCE = 39;

export function defaultCpRoundingMode(): RoundingMode {
  // L'exemple 10,4 → 11 est illustratif en fin de période — pas généralisé.
  return "none";
}

/** Politiques seed versionnées (v1) — guide documenté vs décisions RH. */
export function seedEntitlementPolicyVersions(
  nowIso = "2026-01-01T00:00:00.000Z",
): EntitlementPolicyVersion[] {
  return [
    {
      id: "epv-cp-v1",
      policyId: "ep-cp",
      policyCode: "CP_ACQUISITION_JUN_MAY",
      kind: "conges_payes",
      version: 1,
      effectiveFrom: "2025-06-01",
      effectiveTo: null,
      validationStatus: "guide_documented",
      sourceReference: GUIDE_REF,
      notes:
        "5 semaines ; 2,08 j/mois ; période 1er juin → 31 mai ; CDI/CDD/alternants. CP acquis ≠ CP en acquisition.",
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
          notes:
            "Exemple guide : 10,4 j arrondis à 11 en fin de période d'acquisition — configurable, non appliqué par défaut.",
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
      effectiveTo: null,
      validationStatus: "guide_documented",
      sourceReference: GUIDE_REF,
      notes:
        "Non-cadres : 11 RTT / période annuelle après déduction journée solidarité. Alternants exclus. Prise au fil de l'eau.",
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
        rounding: { mode: "none", notes: "Demi-journée autorisée." },
        expiry: { onMonth: 7, onDay: 1, noCarryover: true },
        negativeBalance: {
          maxNegativeDays: RTT_MAX_NEGATIVE_DAYS,
          checkpoints: [
            {
              month: 1,
              day: 31,
              label: "70 % du prévisionnel annuel pris au 31 janvier",
            },
            {
              month: 6,
              day: 30,
              label: "100 % (reste 30 %) au 30 juin",
            },
          ],
        },
        usageTargets: [
          {
            byMonth: 1,
            byDay: 31,
            percentOfProjectedAnnual: 70,
            label: "70 % RTT pris au 31/01",
          },
          {
            byMonth: 6,
            byDay: 30,
            percentOfProjectedAnnual: 100,
            label: "30 % restants au 30/06",
          },
        ],
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
      effectiveTo: null,
      validationStatus: "requires_hr_decision",
      sourceReference: GUIDE_REF,
      notes:
        "Cadres : 7 à 11 RTT selon jours fériés tombant un jour ouvré — calendrier de bureau obligatoire et validé. Sans calendrier : pas de posting auto.",
      rules: {
        eligibleContractTypes: ["cdi", "cdd"],
        eligibleCategories: ["cadre"],
        acquisitionPeriod: {
          startMonth: 7,
          startDay: 1,
          endMonth: 6,
          endDay: 30,
        },
        annualEntitlementDays: undefined,
        ledgerAccount: "rtt",
        unit: "days",
        allowHalfDay: true,
        rounding: { mode: "none", notes: "Demi-journée autorisée." },
        expiry: { onMonth: 7, onDay: 1, noCarryover: true },
        negativeBalance: {
          maxNegativeDays: RTT_MAX_NEGATIVE_DAYS,
          checkpoints: [
            {
              month: 1,
              day: 31,
              label: "70 % du prévisionnel annuel pris au 31 janvier",
            },
            {
              month: 6,
              day: 30,
              label: "100 % (reste 30 %) au 30 juin",
            },
          ],
        },
        usageTargets: [
          {
            byMonth: 1,
            byDay: 31,
            percentOfProjectedAnnual: 70,
            label: "70 % RTT pris au 31/01",
          },
          {
            byMonth: 6,
            byDay: 30,
            percentOfProjectedAnnual: 100,
            label: "30 % restants au 30/06",
          },
        ],
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
      effectiveTo: null,
      validationStatus: "guide_documented",
      sourceReference: GUIDE_REF,
      notes:
        "Report CP acquis limité à 5 j, non cumulable. Exceptions (incapacité / client) : plan jusqu'au 31/12 + validation partenaire + transmission RRH — jamais auto-approuvé.",
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
      effectiveTo: null,
      validationStatus: "guide_documented",
      sourceReference: GUIDE_REF,
      notes:
        "RTT non reportables ; perdus au 1er juillet. Récupération également à prendre sur la période 1er juil. → 30 juin.",
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
  ];
}

export function selectPolicyVersionsForDate(
  versions: EntitlementPolicyVersion[],
  asOfDate: string,
): EntitlementPolicyVersion[] {
  return versions.filter((v) => {
    if (v.effectiveFrom > asOfDate) return false;
    if (v.effectiveTo && v.effectiveTo < asOfDate) return false;
    return true;
  });
}
