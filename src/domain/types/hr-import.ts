export type HrImportBatchStatus =
  | "uploaded"
  | "mapped"
  | "validated"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type HrImportRowSeverity = "error" | "warning" | "ok";

export type HrImportEmployeeDraft = {
  rowNumber: number;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
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

export type HrImportBalanceDraft = {
  rowNumber: number;
  matricule: string;
  employeeId: string | null;
  cpDays: number | null;
  rttDays: number | null;
  recoveryHours: number | null;
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
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
};

export const HR_IMPORT_OPENING_SOURCE_KIND = "hr_excel_import_opening";

export function importOpeningSourceId(
  batchId: string,
  matricule: string,
  account: string,
): string {
  return `${batchId}:${matricule}:${account}`;
}
