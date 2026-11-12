import type {
  StoredContractType,
  WorkAbsenceCategory,
} from "@/domain/types/hr";
import { isWeekend, parseDateOnly, toDateOnly } from "@/domain/rules/dates";
import { SPECIAL_LEAVE_CATEGORIES } from "@/domain/rules/work-absence";

/**
 * Catalogue configurable des congés spéciaux (guide RH p.45–47).
 *
 * Les plafonds chiffrés non confirmés page à page sont marqués
 * `source: "hypothese_demo"` — en cas de doute le workflow **signale RH**
 * plutôt que de refuser silencieusement. Pas de solde ledger cumulatif.
 */
export type SpecialLeaveEntitlement = {
  category: WorkAbsenceCategory;
  label: string;
  /** null = pas de plafond numérique confirmé → revue RH si demandé */
  maxDays: number | null;
  /** Si true et maxDays dépassé → blocage soumission ; sinon flag revue */
  hardBlockWhenExceeded: boolean;
  eligibility: string;
  supportingDocumentHint: string;
  eligibleContractTypes?: StoredContractType[] | null;
  /** Proches éligibles (guide) — null = non détaillé / revue RH. */
  eligibleRelationships: string[] | null;
  mustBeTakenAroundEvent: boolean;
  calendarYearLimit: boolean;
  accumulatingBalance: false;
  documentsHrOnly: true;
  source: "guide_p46" | "guide_p45_47" | "hypothese_demo";
};

export const SPECIAL_LEAVE_ENTITLEMENTS: SpecialLeaveEntitlement[] = [
  {
    category: "mariage_pacs",
    label: "Mariage / PACS",
    maxDays: 4,
    hardBlockWhenExceeded: false,
    eligibility:
      "Collaborateur concerné par un mariage ou PACS (guide p.46 — modalités exactes à confirmer).",
    supportingDocumentHint: "Acte de mariage / PACS ou convocation officielle.",
    eligibleRelationships: null,
    mustBeTakenAroundEvent: true,
    calendarYearLimit: false,
    accumulatingBalance: false,
    documentsHrOnly: true,
    source: "hypothese_demo",
  },
  {
    category: "naissance_adoption",
    label: "Naissance / adoption",
    maxDays: 3,
    hardBlockWhenExceeded: false,
    eligibility:
      "Naissance ou adoption d'un enfant (guide p.46 — hors congé paternité légal).",
    supportingDocumentHint: "Acte de naissance / adoption.",
    eligibleRelationships: null,
    mustBeTakenAroundEvent: true,
    calendarYearLimit: false,
    accumulatingBalance: false,
    documentsHrOnly: true,
    source: "hypothese_demo",
  },
  {
    category: "deces_proche",
    label: "Décès d'un proche",
    maxDays: 5,
    hardBlockWhenExceeded: false,
    eligibility:
      "Décès d'un proche au sens du guide p.45–47 (périmètre famille selon cas).",
    supportingDocumentHint: "Acte de décès / certificat.",
    eligibleRelationships: [
      "conjoint",
      "enfant",
      "parent",
      "beau-parent",
      "frère_soeur",
      "autre_proche_a_confirmer_rh",
    ],
    mustBeTakenAroundEvent: true,
    calendarYearLimit: false,
    accumulatingBalance: false,
    documentsHrOnly: true,
    source: "hypothese_demo",
  },
  {
    category: "demenagement",
    label: "Déménagement",
    maxDays: 1,
    hardBlockWhenExceeded: false,
    eligibility: "Changement de résidence principale (guide p.46).",
    supportingDocumentHint: "Justificatif de domicile / bail.",
    eligibleRelationships: null,
    mustBeTakenAroundEvent: true,
    calendarYearLimit: false,
    accumulatingBalance: false,
    documentsHrOnly: true,
    source: "hypothese_demo",
  },
  {
    category: "hospitalisation_enfant",
    label: "Hospitalisation d'un enfant",
    maxDays: null,
    hardBlockWhenExceeded: false,
    eligibility:
      "Hospitalisation d'un enfant — durée selon guide p.46 (cas signalé RH si non standard).",
    supportingDocumentHint: "Bulletin d'hospitalisation / attestation.",
    eligibleRelationships: null,
    mustBeTakenAroundEvent: true,
    calendarYearLimit: false,
    accumulatingBalance: false,
    documentsHrOnly: true,
    source: "guide_p46",
  },
  {
    category: "annonce_handicap_ald",
    label: "Annonce handicap / ALD (enfant ou conjoint)",
    maxDays: null,
    hardBlockWhenExceeded: false,
    eligibility:
      "Annonce d'un handicap ou affection de longue durée concernant un enfant ou le conjoint (guide p.46).",
    supportingDocumentHint: "Justificatif administratif (sans diagnostic détaillé).",
    eligibleRelationships: null,
    mustBeTakenAroundEvent: true,
    calendarYearLimit: false,
    accumulatingBalance: false,
    documentsHrOnly: true,
    source: "guide_p46",
  },
  {
    category: "rdv_medicaux_handicap",
    label: "RDV médicaux (travailleur handicapé)",
    maxDays: null,
    hardBlockWhenExceeded: false,
    eligibility:
      "Collaborateur en situation de handicap — rendez-vous médicaux liés (guide p.46).",
    supportingDocumentHint: "Convocation / attestation de rendez-vous.",
    eligibleRelationships: null,
    mustBeTakenAroundEvent: true,
    calendarYearLimit: false,
    accumulatingBalance: false,
    documentsHrOnly: true,
    source: "guide_p46",
  },
  {
    category: "preparation_examen_alternant",
    label: "Préparation d'examen (alternant)",
    maxDays: null,
    hardBlockWhenExceeded: false,
    eligibility:
      "Alternants éligibles préparant un examen (guide p.46) — contrat alternance / stage selon cas.",
    supportingDocumentHint: "Convocation d'examen / attestation organisme.",
    eligibleContractTypes: ["alternance", "stage"],
    eligibleRelationships: null,
    mustBeTakenAroundEvent: true,
    calendarYearLimit: false,
    accumulatingBalance: false,
    documentsHrOnly: true,
    source: "guide_p46",
  },
];

export function getSpecialLeaveEntitlement(
  category: WorkAbsenceCategory,
): SpecialLeaveEntitlement | null {
  return (
    SPECIAL_LEAVE_ENTITLEMENTS.find((e) => e.category === category) ?? null
  );
}

export function evaluateSpecialLeaveEntitlement(input: {
  category: WorkAbsenceCategory;
  requestedDays: number;
  usedDaysThisYear: number;
  contractType: StoredContractType;
}): {
  allowed: boolean;
  requiresHrReview: boolean;
  message: string | null;
  entitlement: SpecialLeaveEntitlement | null;
} {
  if (!SPECIAL_LEAVE_CATEGORIES.includes(input.category)) {
    return {
      allowed: true,
      requiresHrReview: false,
      message: null,
      entitlement: null,
    };
  }
  const entitlement = getSpecialLeaveEntitlement(input.category);
  if (!entitlement) {
    return {
      allowed: true,
      requiresHrReview: true,
      message: "Catégorie sans barème configuré — revue RH requise.",
      entitlement: null,
    };
  }

  if (
    entitlement.eligibleContractTypes &&
    !entitlement.eligibleContractTypes.includes(input.contractType)
  ) {
    return {
      allowed: true,
      requiresHrReview: true,
      message:
        "Éligibilité contrat non confirmée automatiquement — dossier transmis pour revue RH.",
      entitlement,
    };
  }

  if (entitlement.maxDays == null) {
    return {
      allowed: true,
      requiresHrReview: true,
      message:
        "Plafond non chiffré dans le barème ASTER (guide p.46) — revue RH.",
      entitlement,
    };
  }

  const total = input.usedDaysThisYear + input.requestedDays;
  if (total > entitlement.maxDays) {
    if (entitlement.hardBlockWhenExceeded) {
      return {
        allowed: false,
        requiresHrReview: false,
        message: `Durée supérieure au plafond configuré (${entitlement.maxDays} j).`,
        entitlement,
      };
    }
    return {
      allowed: true,
      requiresHrReview: true,
      message: `Dépassement du plafond indicatif (${entitlement.maxDays} j) — revue RH exceptionnelle.`,
      entitlement,
    };
  }

  return {
    allowed: true,
    requiresHrReview: entitlement.source === "hypothese_demo",
    message:
      entitlement.source === "hypothese_demo"
        ? "Barème indicatif (hypothèse démo / guide p.46 à confirmer) — contrôle RH."
        : null,
    entitlement,
  };
}

export function countWeekdaysInclusive(
  startDate: string,
  endDate: string,
): number {
  let count = 0;
  const cursor = parseDateOnly(startDate);
  const last = parseDateOnly(endDate);
  while (cursor <= last) {
    const day = toDateOnly(cursor);
    if (!isWeekend(day)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
