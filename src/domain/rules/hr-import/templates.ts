import type { SheetColumn } from "@/infrastructure/reporting/excel-workbook";

/** Colonnes Template A — Collaborateurs. */
export const EMPLOYEE_TEMPLATE_COLUMNS: SheetColumn[] = [
  { header: "matricule", key: "matricule", width: 16 },
  { header: "prenom", key: "firstName", width: 16 },
  { header: "nom", key: "lastName", width: 16 },
  { header: "email_professionnel", key: "email", width: 28 },
  { header: "departement", key: "department", width: 22 },
  { header: "poste", key: "jobTitle", width: 22 },
  { header: "site", key: "site", width: 18 },
  { header: "date_embauche", key: "hireDate", width: 14 },
  { header: "type_contrat", key: "contractType", width: 14 },
  { header: "statut_emploi", key: "employmentStatus", width: 14 },
  { header: "matricule_manager", key: "managerMatricule", width: 16 },
];

/** Colonnes Template B — Soldes d'ouverture. */
export const BALANCE_TEMPLATE_COLUMNS: SheetColumn[] = [
  { header: "matricule", key: "matricule", width: 16 },
  { header: "solde_cp_jours", key: "cpDays", width: 14 },
  { header: "solde_rtt_jours", key: "rttDays", width: 14 },
  { header: "solde_recuperation_heures", key: "recoveryHours", width: 20 },
  { header: "date_effet", key: "effectiveDate", width: 14 },
  { header: "reference_source", key: "sourceReference", width: 22 },
  { header: "statut_verification_rh", key: "verificationStatus", width: 18 },
  { header: "notes", key: "notes", width: 28 },
];

/** Template C — Historique optionnel (structure future, import non activé). */
export const HISTORY_TEMPLATE_COLUMNS: SheetColumn[] = [
  { header: "matricule", key: "matricule", width: 16 },
  { header: "type_evenement", key: "eventType", width: 18 },
  { header: "date_debut", key: "startDate", width: 14 },
  { header: "date_fin", key: "endDate", width: 14 },
  { header: "quantite", key: "quantity", width: 12 },
  { header: "unite", key: "unit", width: 10 },
  { header: "statut", key: "status", width: 14 },
  { header: "reference", key: "reference", width: 20 },
  { header: "notes", key: "notes", width: 28 },
];

export const EMPLOYEE_FIELD_KEYS = [
  "matricule",
  "firstName",
  "lastName",
  "email",
  "department",
  "jobTitle",
  "site",
  "hireDate",
  "contractType",
  "employmentStatus",
  "managerMatricule",
] as const;

export const BALANCE_FIELD_KEYS = [
  "matricule",
  "cpDays",
  "rttDays",
  "recoveryHours",
  "effectiveDate",
  "sourceReference",
  "verificationStatus",
  "notes",
] as const;

export type EmployeeFieldKey = (typeof EMPLOYEE_FIELD_KEYS)[number];
export type BalanceFieldKey = (typeof BALANCE_FIELD_KEYS)[number];

/** Alias FR courants → clé canonique. */
export const HEADER_ALIASES: Record<string, string> = {
  matricule: "matricule",
  id: "matricule",
  identifiant: "matricule",
  employee_id: "matricule",
  prenom: "firstName",
  "prénom": "firstName",
  first_name: "firstName",
  firstname: "firstName",
  nom: "lastName",
  last_name: "lastName",
  lastname: "lastName",
  email: "email",
  email_professionnel: "email",
  "e-mail": "email",
  mail: "email",
  departement: "department",
  "département": "department",
  department: "department",
  poste: "jobTitle",
  job_title: "jobTitle",
  titre: "jobTitle",
  site: "site",
  localisation: "site",
  date_embauche: "hireDate",
  hire_date: "hireDate",
  embauche: "hireDate",
  type_contrat: "contractType",
  contrat: "contractType",
  contract_type: "contractType",
  statut_emploi: "employmentStatus",
  statut: "employmentStatus",
  employment_status: "employmentStatus",
  matricule_manager: "managerMatricule",
  manager: "managerMatricule",
  manager_id: "managerMatricule",
  solde_cp_jours: "cpDays",
  cp: "cpDays",
  solde_cp: "cpDays",
  conges_payes: "cpDays",
  solde_rtt_jours: "rttDays",
  rtt: "rttDays",
  solde_rtt: "rttDays",
  solde_recuperation_heures: "recoveryHours",
  recuperation_heures: "recoveryHours",
  recovery_hours: "recoveryHours",
  date_effet: "effectiveDate",
  effective_date: "effectiveDate",
  reference_source: "sourceReference",
  source: "sourceReference",
  statut_verification_rh: "verificationStatus",
  verification: "verificationStatus",
  notes: "notes",
  commentaire: "notes",
};

export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function resolveCanonicalHeader(raw: string): string | null {
  const n = normalizeHeader(raw);
  return HEADER_ALIASES[n] ?? (EMPLOYEE_FIELD_KEYS.includes(n as EmployeeFieldKey) ||
  BALANCE_FIELD_KEYS.includes(n as BalanceFieldKey)
    ? n
    : null);
}
