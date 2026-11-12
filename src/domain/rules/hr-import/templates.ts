import type { SheetColumn } from "@/infrastructure/reporting/excel-workbook";
import { readFileSync } from "fs";
import { join } from "path";

/** Chemin du modèle officiel unique (byte-for-byte). */
export const OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH =
  "assets/hr-import/ASTER_Modele_Import_RH_Maroc.xlsx";

export function loadOfficialHrImportTemplateBytes(): Buffer {
  return readFileSync(
    join(process.cwd(), OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH),
  );
}

/** Colonnes canoniques — le téléchargement UI sert le modèle officiel aligné. */
export const EMPLOYEE_TEMPLATE_COLUMNS: SheetColumn[] = [
  { header: "Matricule*", key: "matricule", width: 16 },
  { header: "Nom*", key: "lastName", width: 16 },
  { header: "Prénom*", key: "firstName", width: 16 },
  { header: "E-mail professionnel", key: "email", width: 28 },
  { header: "Département", key: "department", width: 22 },
  { header: "Poste / fonction", key: "jobTitle", width: 22 },
  { header: "Grade*", key: "grade", width: 18 },
  { header: "People Manager", key: "peopleManager", width: 22 },
  { header: "Région*", key: "region", width: 18 },
  { header: "Date d'embauche*", key: "hireDate", width: 14 },
  { header: "Type de contrat", key: "contractType", width: 14 },
  { header: "Statut*", key: "employmentStatus", width: 14 },
  { header: "Date de sortie", key: "departureDate", width: 14 },
  { header: "Remarques RH", key: "notes", width: 28 },
];

export const BALANCE_TEMPLATE_COLUMNS: SheetColumn[] = [
  { header: "Matricule*", key: "matricule", width: 16 },
  { header: "Type de solde*", key: "balanceType", width: 18 },
  { header: "Solde restant*", key: "balanceAmount", width: 14 },
  { header: "Unité", key: "balanceUnit", width: 10 },
  { header: "Date d'effet*", key: "effectiveDate", width: 14 },
  { header: "Source / fichier RH", key: "sourceReference", width: 22 },
  { header: "Référence source / onglet", key: "sourceTabReference", width: 22 },
  { header: "Vérification RH", key: "verificationStatus", width: 18 },
  { header: "Remarques", key: "notes", width: 28 },
];

export const HISTORY_TEMPLATE_COLUMNS: SheetColumn[] = [
  { header: "Matricule*", key: "matricule", width: 16 },
  { header: "Type d'opération*", key: "eventType", width: 18 },
  { header: "Date de début", key: "startDate", width: 14 },
  { header: "Date de fin", key: "endDate", width: 14 },
  { header: "Quantité", key: "quantity", width: 12 },
  { header: "Unité", key: "unit", width: 10 },
  { header: "Statut", key: "status", width: 14 },
  { header: "Référence source", key: "reference", width: 20 },
  { header: "Remarques", key: "notes", width: 28 },
];

export const EMPLOYEE_FIELD_KEYS = [
  "matricule",
  "firstName",
  "lastName",
  "email",
  "department",
  "jobTitle",
  "grade",
  "peopleManager",
  "region",
  "hireDate",
  "contractType",
  "employmentStatus",
  "departureDate",
  "notes",
] as const;

/** Colonnes obsolètes — refusées sans mapping silencieux. */
export const OBSOLETE_EMPLOYEE_FIELD_KEYS = [
  "site",
  "category",
  "managerMatricule",
] as const;

export const BALANCE_FIELD_KEYS = [
  "matricule",
  "balanceType",
  "balanceAmount",
  "balanceUnit",
  "cpDays",
  "rttDays",
  "recoveryHours",
  "effectiveDate",
  "sourceReference",
  "sourceTabReference",
  "verificationStatus",
  "notes",
] as const;

export type EmployeeFieldKey = (typeof EMPLOYEE_FIELD_KEYS)[number];
export type BalanceFieldKey = (typeof BALANCE_FIELD_KEYS)[number];

/** Alias FR courants / modèle officiel → clé canonique. */
export const HEADER_ALIASES: Record<string, string> = {
  matricule: "matricule",
  "matricule*": "matricule",
  id: "matricule",
  identifiant: "matricule",
  employee_id: "matricule",
  prenom: "firstName",
  "prenom*": "firstName",
  "prénom": "firstName",
  "prénom*": "firstName",
  first_name: "firstName",
  firstname: "firstName",
  nom: "lastName",
  "nom*": "lastName",
  last_name: "lastName",
  lastname: "lastName",
  email: "email",
  email_professionnel: "email",
  e_mail: "email",
  e_mail_professionnel: "email",
  mail: "email",
  departement: "department",
  "département": "department",
  department: "department",
  poste: "jobTitle",
  "poste_/_fonction": "jobTitle",
  poste_fonction: "jobTitle",
  job_title: "jobTitle",
  titre: "jobTitle",
  fonction: "jobTitle",
  grade: "grade",
  "grade*": "grade",
  people_manager: "peopleManager",
  peoplemanager: "peopleManager",
  region: "region",
  "région": "region",
  "region*": "region",
  "région*": "region",
  // Colonnes obsolètes : clés canoniques dédiées, refusées par validate.ts
  // (aucune conversion silencieuse Site→Région, Catégorie→Grade, Manager→People Manager).
  site: "site",
  localisation: "site",
  categorie: "category",
  "catégorie": "category",
  category: "category",
  cadre: "category",
  date_embauche: "hireDate",
  "date_dembauche": "hireDate",
  "date_d_embauche": "hireDate",
  "date_d'embauche": "hireDate",
  "date_d'embauche*": "hireDate",
  hire_date: "hireDate",
  embauche: "hireDate",
  type_contrat: "contractType",
  type_de_contrat: "contractType",
  contrat: "contractType",
  contract_type: "contractType",
  statut_emploi: "employmentStatus",
  statut: "employmentStatus",
  "statut*": "employmentStatus",
  employment_status: "employmentStatus",
  matricule_manager: "managerMatricule",
  matricule_du_responsable: "managerMatricule",
  manager: "managerMatricule",
  manager_id: "managerMatricule",
  manager_hierarchique: "managerMatricule",
  date_de_sortie: "departureDate",
  date_sortie: "departureDate",
  remarques_rh: "notes",
  remarques: "notes",
  notes: "notes",
  commentaire: "notes",
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
  type_de_solde: "balanceType",
  "type_de_solde*": "balanceType",
  balance_type: "balanceType",
  solde_restant: "balanceAmount",
  "solde_restant*": "balanceAmount",
  balance_amount: "balanceAmount",
  unite: "balanceUnit",
  "unité": "balanceUnit",
  balance_unit: "balanceUnit",
  date_effet: "effectiveDate",
  "date_deffet": "effectiveDate",
  "date_d_effet": "effectiveDate",
  "date_d'effet": "effectiveDate",
  "date_d'effet*": "effectiveDate",
  effective_date: "effectiveDate",
  reference_source: "sourceReference",
  "source_/_fichier_rh": "sourceReference",
  source_fichier_rh: "sourceReference",
  source: "sourceReference",
  "reference_source_/_onglet": "sourceTabReference",
  reference_source_onglet: "sourceTabReference",
  statut_verification_rh: "verificationStatus",
  verification_rh: "verificationStatus",
  verification: "verificationStatus",
  type_evenement: "eventType",
  type_doperation: "eventType",
  type_d_operation: "eventType",
  type_operation: "eventType",
  event_type: "eventType",
  date_debut: "startDate",
  "date_de_debut": "startDate",
  "date_de_début": "startDate",
  date_fin: "endDate",
  "date_de_fin": "endDate",
  quantite: "quantity",
  "quantité": "quantity",
  reference: "reference",
};

export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\*/g, "")
    .replace(/['’ʼ]/g, "")
    .replace(/-/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function resolveCanonicalHeader(raw: string): string | null {
  const n = normalizeHeader(raw);
  if (HEADER_ALIASES[n]) return HEADER_ALIASES[n];
  // also try without trailing star already stripped
  const starred = normalizeHeader(`${raw}*`);
  if (HEADER_ALIASES[starred]) return HEADER_ALIASES[starred];
  if (
    EMPLOYEE_FIELD_KEYS.includes(n as EmployeeFieldKey) ||
    BALANCE_FIELD_KEYS.includes(n as BalanceFieldKey)
  ) {
    return n;
  }
  return null;
}
