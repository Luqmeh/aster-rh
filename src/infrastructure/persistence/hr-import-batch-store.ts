import type {
  HrImportBalanceDraft,
  HrImportBatch,
  HrImportBatchStatus,
  HrImportEmployeeDraft,
  HrImportExecutionReport,
  HrImportPreviewSummary,
  HrImportProvisioningResult,
} from "@/domain/types/hr-import";
import {
  HR_IMPORT_TEMPLATE_VERSION,
  HR_IMPORT_TYPE_EMPLOYEES_BALANCES,
} from "@/domain/types/hr-import";
import { Prisma } from "@prisma/client";
import { applyPrismaDatabaseEnvFallbacks } from "@/infrastructure/persistence/database-env";
import { getDemoStore } from "@/infrastructure/persistence/demo-store";
import { getPrismaClient } from "@/infrastructure/persistence/prisma-client";
import { resolvePersistenceMode } from "@/infrastructure/persistence/persistence-mode";

function jsonOrNull(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

type DurableWorkbook = {
  batchId: string;
  bytes: Uint8Array;
  contentType: string;
};

declare global {
  var __asterHrImportWorkbooks: Map<string, DurableWorkbook> | undefined;
}

function workbooks(): Map<string, DurableWorkbook> {
  if (!globalThis.__asterHrImportWorkbooks) {
    globalThis.__asterHrImportWorkbooks = new Map();
  }
  return globalThis.__asterHrImportWorkbooks;
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return value as T;
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

function mapRow(row: {
  id: string;
  status: string;
  importType?: string | null;
  templateVersion?: string | null;
  fileName: string;
  storageKey: string | null;
  createdByEmployeeId: string;
  confirmedByEmployeeId: string | null;
  updateExistingEmployees: boolean;
  columnMappingJson: unknown;
  departmentMappingJson: unknown;
  siteMappingJson: unknown;
  previewSummaryJson: unknown;
  executionReportJson: unknown;
  worksheetNamesJson: unknown;
  headersBySheetJson: unknown;
  employeeDraftsJson: unknown;
  balanceDraftsJson: unknown;
  provisioningResultsJson?: unknown;
  totalRows?: number | null;
  validRows?: number | null;
  warningRows?: number | null;
  rejectedRows?: number | null;
  employeesCreated?: number | null;
  employeesUpdated?: number | null;
  balancesImported?: number | null;
  accountsCreated?: number | null;
  accountsExisting?: number | null;
  accountsPending?: number | null;
  accountsFailed?: number | null;
  failureSummary?: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  validatedAt?: Date | string | null;
  executionStartedAt?: Date | string | null;
  executedAt: Date | string | null;
}): HrImportBatch {
  const report = asJson<HrImportExecutionReport | null>(
    row.executionReportJson,
    null,
  );
  const provisioning =
    report?.provisioningResults ??
    asJson<HrImportProvisioningResult[]>(row.provisioningResultsJson, []);
  return {
    id: row.id,
    status: row.status as HrImportBatchStatus,
    importType: row.importType ?? HR_IMPORT_TYPE_EMPLOYEES_BALANCES,
    templateVersion: row.templateVersion ?? HR_IMPORT_TEMPLATE_VERSION,
    fileName: row.fileName,
    storageKey: row.storageKey,
    createdByEmployeeId: row.createdByEmployeeId,
    confirmedByEmployeeId: row.confirmedByEmployeeId,
    updateExistingEmployees: row.updateExistingEmployees,
    columnMappingJson: asJson(row.columnMappingJson, {}),
    departmentMappingJson: asJson(row.departmentMappingJson, {}),
    siteMappingJson: asJson(row.siteMappingJson, {}),
    previewSummary: asJson<HrImportPreviewSummary | null>(
      row.previewSummaryJson,
      null,
    ),
    executionReport: report
      ? { ...report, provisioningResults: provisioning }
      : null,
    worksheetNames: asJson(row.worksheetNamesJson, []),
    headersBySheet: asJson(row.headersBySheetJson, {}),
    employeeDrafts: asJson<HrImportEmployeeDraft[]>(row.employeeDraftsJson, []),
    balanceDrafts: asJson<HrImportBalanceDraft[]>(row.balanceDraftsJson, []),
    totalRows: row.totalRows ?? 0,
    validRows: row.validRows ?? 0,
    warningRows: row.warningRows ?? 0,
    rejectedRows: row.rejectedRows ?? 0,
    employeesCreated: row.employeesCreated ?? report?.employeesCreated ?? 0,
    employeesUpdated: row.employeesUpdated ?? report?.employeesUpdated ?? 0,
    balancesImported: row.balancesImported ?? report?.balancesImported ?? 0,
    accountsCreated: row.accountsCreated ?? report?.accountsCreated ?? 0,
    accountsExisting: row.accountsExisting ?? report?.accountsExisting ?? 0,
    accountsPending: row.accountsPending ?? report?.accountsPending ?? 0,
    accountsFailed: row.accountsFailed ?? report?.accountsFailed ?? 0,
    failureSummary: row.failureSummary ?? null,
    errorMessage: row.errorMessage,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
    validatedAt: iso(row.validatedAt ?? null),
    executionStartedAt: iso(row.executionStartedAt ?? null),
    executedAt: iso(row.executedAt),
  };
}

function countsFromBatch(batch: HrImportBatch) {
  const summary = batch.previewSummary;
  const report = batch.executionReport;
  return {
    totalRows:
      (summary?.totalEmployeeRows ?? 0) + (summary?.totalBalanceRows ?? 0),
    validRows:
      (summary?.validEmployeeRows ?? 0) + (summary?.validBalanceRows ?? 0),
    warningRows:
      (summary?.warningEmployeeRows ?? 0) + (summary?.warningBalanceRows ?? 0),
    rejectedRows:
      (summary?.invalidEmployeeRows ?? 0) + (summary?.invalidBalanceRows ?? 0),
    employeesCreated: report?.employeesCreated ?? batch.employeesCreated,
    employeesUpdated: report?.employeesUpdated ?? batch.employeesUpdated,
    balancesImported: report?.balancesImported ?? batch.balancesImported,
    accountsCreated: report?.accountsCreated ?? batch.accountsCreated,
    accountsExisting: report?.accountsExisting ?? batch.accountsExisting,
    accountsPending: report?.accountsPending ?? batch.accountsPending,
    accountsFailed: report?.accountsFailed ?? batch.accountsFailed,
  };
}

async function shouldUsePrismaPersistence(): Promise<boolean> {
  try {
    applyPrismaDatabaseEnvFallbacks();
    return resolvePersistenceMode() === "prisma";
  } catch {
    return false;
  }
}

function memoryList(): HrImportBatch[] {
  return getDemoStore().hrImportBatches;
}

export async function listHrImportBatches(): Promise<HrImportBatch[]> {
  if (await shouldUsePrismaPersistence()) {
    const rows = await getPrismaClient().hrImportBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map(mapRow);
  }
  return [...memoryList()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function getHrImportBatch(
  id: string,
): Promise<HrImportBatch | null> {
  if (await shouldUsePrismaPersistence()) {
    const row = await getPrismaClient().hrImportBatch.findUnique({
      where: { id },
    });
    return row ? mapRow(row) : null;
  }
  return memoryList().find((b) => b.id === id) ?? null;
}

export async function saveHrImportBatch(
  batch: HrImportBatch,
): Promise<HrImportBatch> {
  const counts = countsFromBatch(batch);
  const next: HrImportBatch = { ...batch, ...counts, updatedAt: new Date().toISOString() };

  if (await shouldUsePrismaPersistence()) {
    const data = {
      status: next.status,
      importType: next.importType,
      templateVersion: next.templateVersion,
      fileName: next.fileName,
      storageKey: next.storageKey,
      createdByEmployeeId: next.createdByEmployeeId,
      confirmedByEmployeeId: next.confirmedByEmployeeId,
      updateExistingEmployees: next.updateExistingEmployees,
      columnMappingJson: next.columnMappingJson as Prisma.InputJsonValue,
      departmentMappingJson:
        next.departmentMappingJson as Prisma.InputJsonValue,
      siteMappingJson: next.siteMappingJson as Prisma.InputJsonValue,
      previewSummaryJson: jsonOrNull(next.previewSummary),
      executionReportJson: jsonOrNull(next.executionReport),
      worksheetNamesJson: next.worksheetNames as Prisma.InputJsonValue,
      headersBySheetJson: next.headersBySheet as Prisma.InputJsonValue,
      employeeDraftsJson: next.employeeDrafts as Prisma.InputJsonValue,
      balanceDraftsJson: next.balanceDrafts as Prisma.InputJsonValue,
      provisioningResultsJson: (next.executionReport?.provisioningResults ??
        []) as Prisma.InputJsonValue,
      totalRows: next.totalRows,
      validRows: next.validRows,
      warningRows: next.warningRows,
      rejectedRows: next.rejectedRows,
      employeesCreated: next.employeesCreated,
      employeesUpdated: next.employeesUpdated,
      balancesImported: next.balancesImported,
      accountsCreated: next.accountsCreated,
      accountsExisting: next.accountsExisting,
      accountsPending: next.accountsPending,
      accountsFailed: next.accountsFailed,
      failureSummary: next.failureSummary,
      errorMessage: next.errorMessage,
      validatedAt: next.validatedAt ? new Date(next.validatedAt) : null,
      executionStartedAt: next.executionStartedAt
        ? new Date(next.executionStartedAt)
        : null,
      executedAt: next.executedAt ? new Date(next.executedAt) : null,
    };
    const row = await getPrismaClient().hrImportBatch.upsert({
      where: { id: next.id },
      create: {
        id: next.id,
        createdAt: new Date(next.createdAt),
        ...data,
      },
      update: data,
    });
    return mapRow(row);
  }

  const list = memoryList();
  const idx = list.findIndex((b) => b.id === next.id);
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  return next;
}

/**
 * Claim atomique d'exécution — empêche les doubles exécutions concurrentes.
 * Retourne le lot à jour si le claim réussit, sinon null.
 */
export async function claimHrImportBatchExecution(
  id: string,
  fromStatuses: HrImportBatchStatus[],
): Promise<HrImportBatch | null> {
  const now = new Date();
  if (await shouldUsePrismaPersistence()) {
    const result = await getPrismaClient().hrImportBatch.updateMany({
      where: { id, status: { in: fromStatuses } },
      data: {
        status: "executing",
        executionStartedAt: now,
        errorMessage: null,
        failureSummary: null,
      },
    });
    if (result.count !== 1) return null;
    return getHrImportBatch(id);
  }

  const batch = memoryList().find((b) => b.id === id);
  if (!batch || !fromStatuses.includes(batch.status)) return null;
  batch.status = "executing";
  batch.executionStartedAt = now.toISOString();
  batch.updatedAt = now.toISOString();
  batch.errorMessage = null;
  batch.failureSummary = null;
  return { ...batch };
}

export async function putHrImportWorkbook(
  batchId: string,
  bytes: Uint8Array,
  contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
): Promise<void> {
  workbooks().set(batchId, { batchId, bytes, contentType });
}

export async function getHrImportWorkbook(
  batchId: string,
): Promise<Uint8Array | null> {
  return workbooks().get(batchId)?.bytes ?? null;
}

export async function deleteHrImportWorkbook(batchId: string): Promise<void> {
  workbooks().delete(batchId);
}

/** Efface uniquement le cache process des classeurs (simule redémarrage partiel). */
export function resetHrImportWorkbookCacheForTests(): void {
  globalThis.__asterHrImportWorkbooks = undefined;
}
