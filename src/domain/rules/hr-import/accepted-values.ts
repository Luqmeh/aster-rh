import { departments } from "@/data/demo-seed";
import { EMPLOYEE_GRADE_LABELS, EMPLOYEE_GRADE_VALUES } from "@/domain/types/employee-structure";

/**
 * Valeurs affichées dans le modèle Excel (feuille Listes / listes déroulantes).
 * Doivent être acceptées telles quelles par normalize* / resolve* côté importateur.
 * Ne pas y mettre de valeurs que le serveur refuse (ex. « Autre », « À préciser »).
 */

/** Statut* — normalizeEmploymentStatus */
export const HR_IMPORT_STATUS_OPTIONS = [
  "Actif",
  "Suspendu",
  "Sorti",
] as const;

/** Type de contrat — normalizeContractType (casse souple) */
export const HR_IMPORT_CONTRACT_OPTIONS = [
  "CDI",
  "CDD",
  "Alternance",
  "Stage",
] as const;

/** Type de solde* — normalizeBalanceType */
export const HR_IMPORT_BALANCE_TYPE_OPTIONS = [
  "CP",
  "RTT",
  "RECUPERATION_HEURES",
] as const;

/** Unité soldes / historique — normalizeBalanceUnit */
export const HR_IMPORT_UNIT_OPTIONS = ["Jours", "Heures"] as const;

/** Vérification RH — libre côté serveur, valeurs recommandées du modèle */
export const HR_IMPORT_VERIFICATION_OPTIONS = [
  "À vérifier",
  "Vérifié par RH",
] as const;

/**
 * Historique optionnel (non exécuté) — valeurs du modèle pour cohérence UI.
 * Ne pas élargir sans besoin métier documenté.
 */
export const HR_IMPORT_HISTORY_EVENT_OPTIONS = [
  "CONGE_APPROUVE",
  "ABSENCE",
  "TELETRAVAIL",
  "RECUPERATION_CREDIT",
  "AUTRE",
] as const;

export const HR_IMPORT_HISTORY_STATUS_OPTIONS = [
  "En attente",
  "Approuvé",
  "Refusé",
  "Annulé",
  "Crédité",
  "À confirmer",
] as const;

/** Codes département du référentiel démo (resolveDepartmentId par code). */
export const HR_IMPORT_DEPARTMENT_OPTIONS = departments.map((d) => d.code);

/**
 * Grade — libellés français exacts (doivent matcher parseEmployeeGrade / Excel).
 * Pas de liste Site / cadre.
 */
export const HR_IMPORT_GRADE_OPTIONS = EMPLOYEE_GRADE_VALUES.map(
  (v) => EMPLOYEE_GRADE_LABELS[v],
);

/** @deprecated Site n'est plus une colonne canonique — ne pas réintroduire en dropdown. */
export const HR_IMPORT_SITE_OPTIONS: readonly string[] = [];

/** Champs strictement libres (pas de liste Excel). */
export const HR_IMPORT_FREE_TEXT_EMPLOYEE_FIELDS = [
  "matricule",
  "lastName",
  "firstName",
  "email",
  "jobTitle",
  "region",
  "peopleManager",
  "notes",
] as const;

export type HrImportListColumn = {
  header: string;
  values: readonly string[];
};

/** Colonnes de la feuille Listes (A…). */
export const HR_IMPORT_LISTES_COLUMNS: HrImportListColumn[] = [
  { header: "Statut", values: HR_IMPORT_STATUS_OPTIONS },
  { header: "Type de contrat", values: HR_IMPORT_CONTRACT_OPTIONS },
  { header: "Type de solde", values: HR_IMPORT_BALANCE_TYPE_OPTIONS },
  { header: "Unité", values: HR_IMPORT_UNIT_OPTIONS },
  { header: "Vérification", values: HR_IMPORT_VERIFICATION_OPTIONS },
  { header: "Type d'opération", values: HR_IMPORT_HISTORY_EVENT_OPTIONS },
  { header: "Département", values: HR_IMPORT_DEPARTMENT_OPTIONS },
  { header: "Grade", values: HR_IMPORT_GRADE_OPTIONS },
  { header: "Statut historique", values: HR_IMPORT_HISTORY_STATUS_OPTIONS },
];
