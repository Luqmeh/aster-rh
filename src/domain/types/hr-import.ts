export type HrImportBatchStatus =
  | "uploaded"
  | "validating"
  | "validated"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

export type HrImportRowSeverity = "error" | "warning" | "ok";

export type HrImportProvisioningStatus =
  | "created"
  | "already_existing"
  | "pending"
  | "failed"
  | "skipped";

export type HrImportEmployeeDraft = {
  rowNumber: number;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  /** True when Excel n'avait pas d'e-mail pro — compte en attente. */
  emailMissing: boolean;
  departmentRaw: string;
  departmentId: string | null;
  jobTitle: string;
  site: string;
  hireDate: string | null;
  contractType: string | null;
  employmentStatus: string | null;
  managerMatricule: string | null;
  managerId: string | null;
  action: "create" | "update" | "skip";
  existingEmployeeId: string | null;
  severity: HrImportRowSeverity;
  messages: string[];
};

export type HrImportBalanceKind = "CP" | "RTT" | "RECUPERATION_HEURES";

export type HrImportBalanceDraft = {
  rowNumber: number;
  matricule: string;
  employeeId: string | null;
  /** Format officiel : une ligne = un type. */
  balanceType: HrImportBalanceKind | null;
  balanceAmount: number | null;
  balanceUnit: "jours" | "heures" | null;
  cpDays: number | null;
  rttDays: number | null;
  recoveryHours: number | null;
  /** Conservé pour compat legacy uniquement — ne plus convertir silencieusement. */
  recoveryDays: number | null;
  effectiveDate: string | null;
  sourceReference: string;
  verificationStatus: string;
  notes: string | null;
  severity: HrImportRowSeverity;
  messages: string[];
};

export type HrImportPreviewSummary = {
  totalEmployeeRows: number;
  validEmployeeRows: number;
  warningEmployeeRows: number;
  invalidEmployeeRows: number;
  newEmployees: number;
  existingEmployees: number;
  totalBalanceRows: number;
  validBalanceRows: number;
  warningBalanceRows: number;
  invalidBalanceRows: number;
  openingCpTotal: number;
  openingRttTotal: number;
  openingRecoveryDaysTotal: number;
};

/** Résultat de provisioning — jamais de mot de passe en clair. */
export type HrImportProvisioningResult = {
  matricule: string;
  employeeId: string;
  email: string | null;
  status: HrImportProvisioningStatus;
  message: string;
};

export type HrImportExecutionReport = {
  batchId: string;
  executedAt: string;
  actorEmployeeId: string;
  employeesCreated: number;
  employeesUpdated: number;
  balancesImported: number;
  rejectedRows: number;
  warningRows: number;
  openingCpTotal: number;
  openingRttTotal: number;
  openingRecoveryDaysTotal: number;
  accountsCreated: number;
  accountsExisting: number;
  accountsPending: number;
  accountsFailed: number;
  provisioningResults: HrImportProvisioningResult[];
  manualIntervention: string[];
  reconciliation: Array<{
    matricule: string;
    employeeId: string;
    excelCp: number | null;
    excelRtt: number | null;
    excelRecoveryDays: number | null;
    asterCp: number | null;
    asterRtt: number | null;
    asterRecoveryDays: number | null;
  }>;
};

export type HrImportBatch = {
  id: string;
  status: HrImportBatchStatus;
  importType: string;
  templateVersion: string;
  fileName: string;
  storageKey: string | null;
  createdByEmployeeId: string;
  confirmedByEmployeeId: string | null;
  updateExistingEmployees: boolean;
  columnMappingJson: Record<string, string>;
  departmentMappingJson: Record<string, string>;
  siteMappingJson: Record<string, string>;
  employeeDrafts: HrImportEmployeeDraft[];
  balanceDrafts: HrImportBalanceDraft[];
  previewSummary: HrImportPreviewSummary | null;
  executionReport: HrImportExecutionReport | null;
  worksheetNames: string[];
  headersBySheet: Record<string, string[]>;
  totalRows: number;
  validRows: number;
  warningRows: number;
  rejectedRows: number;
  employeesCreated: number;
  employeesUpdated: number;
  balancesImported: number;
  accountsCreated: number;
  accountsExisting: number;
  accountsPending: number;
  accountsFailed: number;
  failureSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
  executionStartedAt: string | null;
  executedAt: string | null;
};

export const HR_IMPORT_OPENING_SOURCE_KIND = "hr_excel_import_opening";
export const HR_IMPORT_TEMPLATE_VERSION = "1";
export const HR_IMPORT_TYPE_EMPLOYEES_BALANCES = "employees_balances";

export function importOpeningSourceId(
  batchId: string,
  matricule: string,
  account: string,
): string {
  return `${batchId}:${matricule}:${account}`;
}

/** E-mail technique pour fiche sans adresse pro — pas de mailbox, pas de compte. */
export function pendingImportEmail(matricule: string): string {
  const safe = matricule
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, 48);
  return `pending.${safe || "unknown"}@no-mailbox.aster-rh.local`;
}

export function isPendingImportEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@no-mailbox.aster-rh.local");
}

export function isTerminalImportStatus(status: HrImportBatchStatus): boolean {
  return (
    status === "completed" ||
    status === "completed_with_errors" ||
    status === "cancelled"
  );
}

export function canRetryImportExecution(status: HrImportBatchStatus): boolean {
  return status === "awaiting_confirmation" || status === "failed";
}

/** Lots non exécutés pouvant être abandonnés (pas executing / terminaux). */
export function canCancelImportBatch(status: HrImportBatchStatus): boolean {
  return (
    status === "uploaded" ||
    status === "validating" ||
    status === "validated" ||
    status === "awaiting_confirmation" ||
    status === "failed"
  );
}
