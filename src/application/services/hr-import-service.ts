import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import {
  autoDetectColumnMapping,
  parseExcelWorkbook,
  pickBalanceSheet,
  pickEmployeeSheet,
  type ParsedWorkbook,
} from "@/domain/rules/hr-import/parse";
import {
  BALANCE_TEMPLATE_COLUMNS,
  EMPLOYEE_TEMPLATE_COLUMNS,
  HISTORY_TEMPLATE_COLUMNS,
} from "@/domain/rules/hr-import/templates";
import {
  buildPreviewSummary,
  validateBalanceRows,
  validateEmployeeRows,
} from "@/domain/rules/hr-import/validate";
import {
  canExecuteHrImport,
  canViewHrImport,
} from "@/domain/rules/permissions";
import type {
  HrImportBatch,
  HrImportExecutionReport,
  HrImportPreviewSummary,
} from "@/domain/types/hr-import";
import {
  HR_IMPORT_OPENING_SOURCE_KIND,
  importOpeningSourceId,
} from "@/domain/types/hr-import";
import type { ContractType, EmploymentStatus } from "@/domain/types/hr";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";
import { createStyledWorkbook } from "@/infrastructure/reporting/excel-workbook";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type ImportMemory = {
  batches: HrImportBatch[];
  /** Buffers temporaires — jamais exposés publiquement. */
  buffers: Map<string, Uint8Array>;
  parsed: Map<string, ParsedWorkbook>;
};

declare global {
  var __asterHrImportMemory: ImportMemory | undefined;
}

function memory(): ImportMemory {
  if (!globalThis.__asterHrImportMemory) {
    globalThis.__asterHrImportMemory = {
      batches: [],
      buffers: new Map(),
      parsed: new Map(),
    };
  }
  return globalThis.__asterHrImportMemory;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function emptySummary(): HrImportPreviewSummary {
  return {
    totalEmployeeRows: 0,
    validEmployeeRows: 0,
    warningEmployeeRows: 0,
    invalidEmployeeRows: 0,
    newEmployees: 0,
    existingEmployees: 0,
    totalBalanceRows: 0,
    validBalanceRows: 0,
    warningBalanceRows: 0,
    invalidBalanceRows: 0,
    openingCpTotal: 0,
    openingRttTotal: 0,
    openingRecoveryDaysTotal: 0,
  };
}

function assertCanView(session: AuthSession) {
  requireSession(session);
  if (!canViewHrImport(session.role)) {
    throw new AuthError("Import RH réservé à l'administration.", 403);
  }
}

function assertCanExecute(session: AuthSession) {
  requireSession(session);
  if (!canExecuteHrImport(session.role)) {
    throw new AuthError(
      "Exécution d'import réservée aux Ressources humaines.",
      403,
    );
  }
}

export function createHrImportService(deps: {
  hr: HrRepository;
  storage?: DocumentStoragePort | null;
}) {
  const leaveLedger = createLeaveLedgerService({ hr: deps.hr });

  return {
    async downloadTemplate(
      session: AuthSession,
      kind: "employees" | "balances" | "history",
    ) {
      assertCanView(session);
      const columns =
        kind === "employees"
          ? EMPLOYEE_TEMPLATE_COLUMNS
          : kind === "balances"
            ? BALANCE_TEMPLATE_COLUMNS
            : HISTORY_TEMPLATE_COLUMNS;
      const sheetName =
        kind === "employees"
          ? "Collaborateurs"
          : kind === "balances"
            ? "Soldes_ouverture"
            : "Historique_optionnel";
      const sample =
        kind === "employees"
          ? [
              {
                matricule: "emp-exemple",
                firstName: "Imane",
                lastName: "Exemple",
                email: "imane.exemple@demo.aster-rh.local",
                department: "AUD",
                jobTitle: "Consultante",
                site: "Casablanca (démo)",
                hireDate: "2024-01-15",
                contractType: "cdi",
                employmentStatus: "actif",
                managerMatricule: "",
              },
            ]
          : kind === "balances"
            ? [
                {
                  matricule: "emp-exemple",
                  cpDays: 12,
                  rttDays: 0,
                  recoveryHours: 7,
                  effectiveDate: "2026-01-01",
                  sourceReference: "Inventaire RH 2026",
                  verificationStatus: "verifie",
                  notes: "",
                },
              ]
            : [
                {
                  matricule: "emp-exemple",
                  eventType: "conge_approuve",
                  startDate: "2025-08-01",
                  endDate: "2025-08-05",
                  quantity: 5,
                  unit: "jours",
                  status: "approuvee",
                  reference: "HIST-001",
                  notes: "Import historique — non activé dans cette version",
                },
              ];
      return createStyledWorkbook(sheetName, columns, sample);
    },

    async downloadExecutionReport(session: AuthSession, batchId: string) {
      assertCanView(session);
      const batch = memory().batches.find((b) => b.id === batchId);
      if (!batch?.executionReport) {
        throw new Error("Rapport indisponible — lot non exécuté.");
      }
      const report = batch.executionReport;
      return createStyledWorkbook(
        "Rapport_import",
        [
          { header: "matricule", key: "matricule", width: 16 },
          { header: "employee_id", key: "employeeId", width: 16 },
          { header: "excel_cp", key: "excelCp", width: 12 },
          { header: "aster_cp", key: "asterCp", width: 12 },
          { header: "excel_rtt", key: "excelRtt", width: 12 },
          { header: "aster_rtt", key: "asterRtt", width: 12 },
          { header: "excel_recup_j", key: "excelRecoveryDays", width: 14 },
          { header: "aster_recup_j", key: "asterRecoveryDays", width: 14 },
        ],
        report.reconciliation.map((r) => ({
          matricule: r.matricule,
          employeeId: r.employeeId,
          excelCp: r.excelCp,
          asterCp: r.asterCp,
          excelRtt: r.excelRtt,
          asterRtt: r.asterRtt,
          excelRecoveryDays: r.excelRecoveryDays,
          asterRecoveryDays: r.asterRecoveryDays,
        })),
      ).then((wb) => ({
        ...wb,
        fileName: `aster-rapport-import-${batch.id}.xlsx`,
        summary: {
          batchId: report.batchId,
          executedAt: report.executedAt,
          actorEmployeeId: report.actorEmployeeId,
          employeesCreated: report.employeesCreated,
          employeesUpdated: report.employeesUpdated,
          balancesImported: report.balancesImported,
          rejectedRows: report.rejectedRows,
          warningRows: report.warningRows,
        },
      }));
    },

    listBatches(session: AuthSession): HrImportBatch[] {
      assertCanView(session);
      return memory().batches;
    },

    getBatch(session: AuthSession, batchId: string): HrImportBatch | null {
      assertCanView(session);
      return memory().batches.find((b) => b.id === batchId) ?? null;
    },

    async uploadWorkbook(
      session: AuthSession,
      input: { fileName: string; bytes: Uint8Array },
    ): Promise<HrImportBatch> {
      assertCanExecute(session);
      if (!input.fileName.toLowerCase().endsWith(".xlsx")) {
        throw new Error("Seuls les fichiers .xlsx sont acceptés.");
      }
      if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_UPLOAD_BYTES) {
        throw new Error("Fichier vide ou supérieur à 5 Mo.");
      }

      const parsed = await parseExcelWorkbook(input.bytes);
      const batchId = newId("imp");
      let storageKey: string | null = null;
      if (deps.storage) {
        const key = `imports/private/${batchId}/${input.fileName.replace(/[^\w.\-]+/g, "_")}`;
        await deps.storage.putObject(
          key,
          input.bytes,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        storageKey = key;
      }

      const headersBySheet = Object.fromEntries(
        parsed.worksheets.map((s) => [s.name, s.headers]),
      );
      const empSheet = pickEmployeeSheet(parsed.worksheets);
      const balSheet = pickBalanceSheet(parsed.worksheets);
      const mapping = autoDetectColumnMapping([
        ...(empSheet?.headers ?? []),
        ...(balSheet?.headers ?? []),
      ]);

      const now = new Date().toISOString();
      const batch: HrImportBatch = {
        id: batchId,
        status: "uploaded",
        fileName: input.fileName,
        storageKey,
        createdByEmployeeId: session.employee.id,
        confirmedByEmployeeId: null,
        updateExistingEmployees: false,
        columnMappingJson: mapping,
        departmentMappingJson: {},
        siteMappingJson: {},
        employeeDrafts: [],
        balanceDrafts: [],
        previewSummary: emptySummary(),
        executionReport: null,
        worksheetNames: parsed.worksheets.map((s) => s.name),
        headersBySheet,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        executedAt: null,
      };
      memory().batches.unshift(batch);
      memory().buffers.set(batchId, input.bytes);
      memory().parsed.set(batchId, parsed);
      return batch;
    },

    async validateBatch(
      session: AuthSession,
      input: {
        batchId: string;
        updateExistingEmployees?: boolean;
        columnMapping?: Record<string, string>;
        departmentMapping?: Record<string, string>;
        siteMapping?: Record<string, string>;
      },
    ): Promise<HrImportBatch> {
      assertCanExecute(session);
      const batch = memory().batches.find((b) => b.id === input.batchId);
      if (!batch) throw new AuthError("Lot d'import introuvable.", 404);
      if (batch.status === "completed" || batch.status === "executing") {
        throw new Error("Ce lot est déjà exécuté ou en cours.");
      }
      const parsed = memory().parsed.get(batch.id);
      if (!parsed) throw new Error("Fichier source indisponible — réimportez le classeur.");

      if (input.updateExistingEmployees != null) {
        batch.updateExistingEmployees = input.updateExistingEmployees;
      }
      if (input.columnMapping) batch.columnMappingJson = input.columnMapping;
      if (input.departmentMapping) {
        batch.departmentMappingJson = input.departmentMapping;
      }
      if (input.siteMapping) {
        batch.siteMappingJson = input.siteMapping;
      }

      const [departments, employees] = await Promise.all([
        deps.hr.listDepartments(),
        deps.hr.listEmployees({ includeInactive: true }),
      ]);
      const knownSites = [
        ...new Set(employees.map((e) => e.site).filter(Boolean)),
      ];
      const empSheet = pickEmployeeSheet(parsed.worksheets);
      const balSheet = pickBalanceSheet(parsed.worksheets);

      const employeeDrafts = empSheet
        ? validateEmployeeRows({
            rows: empSheet.rows,
            mapping: batch.columnMappingJson,
            departmentMapping: batch.departmentMappingJson,
            siteMapping: batch.siteMappingJson,
            departments,
            knownSites,
            existingEmployees: employees,
            updateExisting: batch.updateExistingEmployees,
          })
        : [];
      const balanceDrafts = balSheet
        ? validateBalanceRows({
            rows: balSheet.rows,
            mapping: batch.columnMappingJson,
            employeeDrafts,
            existingEmployees: employees,
          })
        : [];

      batch.employeeDrafts = employeeDrafts;
      batch.balanceDrafts = balanceDrafts;
      batch.previewSummary = buildPreviewSummary(employeeDrafts, balanceDrafts);
      batch.status = "awaiting_confirmation";
      batch.updatedAt = new Date().toISOString();
      batch.errorMessage = null;
      return batch;
    },

    async confirmAndExecute(
      session: AuthSession,
      input: { batchId: string; confirmationPhrase: string },
    ): Promise<HrImportBatch> {
      assertCanExecute(session);
      const batch = memory().batches.find((b) => b.id === input.batchId);
      if (!batch) throw new AuthError("Lot d'import introuvable.", 404);
      if (batch.status === "completed") {
        throw new Error("Lot déjà exécuté — réexécution refusée (idempotence).");
      }
      if (batch.status === "executing") {
        throw new Error("Exécution déjà en cours.");
      }
      if (batch.status !== "awaiting_confirmation") {
        throw new Error("Validez d'abord le lot (prévisualisation).");
      }
      if (input.confirmationPhrase.trim().toUpperCase() !== "IMPORTER") {
        throw new Error('Confirmation requise : saisissez exactement « IMPORTER ».');
      }
      if (
        batch.employeeDrafts.some((e) => e.severity === "error") ||
        batch.balanceDrafts.some((b) => b.severity === "error")
      ) {
        throw new Error(
          "Des lignes invalides restent présentes — corrigez le fichier ou retirez-les.",
        );
      }

      batch.status = "executing";
      batch.updatedAt = new Date().toISOString();

      try {
        const report = await this.executeBatch(session, batch);
        batch.executionReport = report;
        batch.status = "completed";
        batch.confirmedByEmployeeId = session.employee.id;
        batch.executedAt = report.executedAt;
        batch.updatedAt = report.executedAt;
        memory().buffers.delete(batch.id);
        return batch;
      } catch (err) {
        batch.status = "failed";
        batch.errorMessage =
          err instanceof Error ? err.message : "Échec d'exécution.";
        batch.updatedAt = new Date().toISOString();
        throw err;
      }
    },

    async executeBatch(
      session: AuthSession,
      batch: HrImportBatch,
    ): Promise<HrImportExecutionReport> {
      let created = 0;
      let updated = 0;
      let balancesImported = 0;
      const manual: string[] = [];
      const createdIds = new Set<string>();

      // Pass 1 — create / update employees (without manager links needing new IDs)
      for (const draft of batch.employeeDrafts) {
        if (draft.severity === "error") continue;
        if (draft.action === "create") {
          const initials = `${draft.firstName[0] ?? ""}${draft.lastName[0] ?? ""}`
            .toUpperCase()
            .slice(0, 2);
          await deps.hr.createEmployee({
            id: draft.matricule,
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.email,
            jobTitle: draft.jobTitle,
            departmentId: draft.departmentId!,
            managerId: null,
            site: draft.site,
            contractType: draft.contractType as ContractType,
            category: "non_applicable",
            hireDate: draft.hireDate!,
            employmentStatus: (draft.employmentStatus ??
              "actif") as EmploymentStatus,
            departureDate: null,
            departureNote: null,
            phoneInternal: null,
            avatarInitials: initials || "XX",
            teleworkEligible: true,
            policyGroup: "standard_ma",
            activitySector: "non_agricole",
          });
          created += 1;
          createdIds.add(draft.matricule);
        } else if (draft.action === "update" && draft.existingEmployeeId) {
          await deps.hr.updateEmployee(draft.existingEmployeeId, {
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.email,
            jobTitle: draft.jobTitle,
            departmentId: draft.departmentId ?? undefined,
            site: draft.site,
            contractType: draft.contractType as ContractType,
            hireDate: draft.hireDate ?? undefined,
            employmentStatus: draft.employmentStatus as EmploymentStatus,
          });
          updated += 1;
        }
      }

      // Pass 2 — manager links
      for (const draft of batch.employeeDrafts) {
        if (draft.severity === "error") continue;
        if (!draft.managerMatricule) continue;
        const targetId =
          draft.action === "update"
            ? draft.existingEmployeeId
            : draft.matricule;
        if (!targetId) continue;
        const mgr =
          (await deps.hr.getEmployee(draft.managerMatricule)) ??
          (createdIds.has(draft.managerMatricule)
            ? await deps.hr.getEmployee(draft.managerMatricule)
            : null);
        if (!mgr) {
          manual.push(
            `Manager ${draft.managerMatricule} non lié pour ${draft.matricule}.`,
          );
          continue;
        }
        await deps.hr.updateEmployee(targetId, { managerId: mgr.id });
      }

      const reconciliation: HrImportExecutionReport["reconciliation"] = [];

      for (const bal of batch.balanceDrafts) {
        if (bal.severity === "error" || !bal.matricule || !bal.effectiveDate) {
          continue;
        }
        const employee = await deps.hr.getEmployee(bal.matricule);
        if (!employee) {
          manual.push(`Solde ignoré — ${bal.matricule} introuvable à l'exécution.`);
          continue;
        }
        const year = Number(bal.effectiveDate.slice(0, 4)) || 2026;
        const accounts: Array<{
          account: "conges_payes" | "rtt" | "recuperation";
          qty: number;
        }> = [];
        if (bal.cpDays != null && bal.cpDays !== 0) {
          accounts.push({ account: "conges_payes", qty: bal.cpDays });
        }
        if (bal.rttDays != null && bal.rttDays !== 0) {
          accounts.push({ account: "rtt", qty: bal.rttDays });
        }
        if (bal.recoveryDays != null && bal.recoveryDays !== 0) {
          accounts.push({ account: "recuperation", qty: bal.recoveryDays });
        }

        for (const { account, qty } of accounts) {
          const sourceId = importOpeningSourceId(
            batch.id,
            bal.matricule,
            account,
          );
          const { created: entryCreated } =
            await deps.hr.appendLeaveLedgerEntry({
              employeeId: employee.id,
              account,
              transactionType: "opening_balance",
              quantity: qty,
              unit: "days",
              year,
              effectiveDate: bal.effectiveDate,
              sourceKind: HR_IMPORT_OPENING_SOURCE_KIND,
              sourceId,
              reason: `Ouverture Excel (${bal.sourceReference || "import RH"}) — lot ${batch.id}.`,
              actorEmployeeId: session.employee.id,
              metadataJson: {
                importBatchId: batch.id,
                matricule: bal.matricule,
                verificationStatus: bal.verificationStatus,
                notes: bal.notes,
                recoveryHours: bal.recoveryHours,
                sourceReference: bal.sourceReference,
              },
            });
          if (entryCreated) balancesImported += 1;
          else {
            manual.push(
              `Ouverture ${account} déjà présente pour ${bal.matricule} (idempotence).`,
            );
          }
        }
        await leaveLedger.materializeLeaveBalanceProjection(employee.id, year);
        const snap = await leaveLedger.getBalanceForLeaveType(
          session,
          employee.id,
          "conges_payes",
          year,
        );
        const rtt = await leaveLedger.getBalanceForLeaveType(
          session,
          employee.id,
          "rtt",
          year,
        );
        const rec = await leaveLedger.getBalanceForLeaveType(
          session,
          employee.id,
          "recuperation",
          year,
        );
        reconciliation.push({
          matricule: bal.matricule,
          employeeId: employee.id,
          excelCp: bal.cpDays,
          excelRtt: bal.rttDays,
          excelRecoveryDays: bal.recoveryDays,
          asterCp: snap?.ledgerBalance ?? null,
          asterRtt: rtt?.ledgerBalance ?? null,
          asterRecoveryDays: rec?.ledgerBalance ?? null,
        });
      }

      const summary = batch.previewSummary ?? emptySummary();
      return {
        batchId: batch.id,
        executedAt: new Date().toISOString(),
        actorEmployeeId: session.employee.id,
        employeesCreated: created,
        employeesUpdated: updated,
        balancesImported,
        rejectedRows:
          summary.invalidEmployeeRows + summary.invalidBalanceRows,
        warningRows:
          summary.warningEmployeeRows + summary.warningBalanceRows,
        openingCpTotal: summary.openingCpTotal,
        openingRttTotal: summary.openingRttTotal,
        openingRecoveryDaysTotal: summary.openingRecoveryDaysTotal,
        manualIntervention: manual,
        reconciliation,
      };
    },
  };
}

export type HrImportService = ReturnType<typeof createHrImportService>;

export function resetHrImportMemoryForTests(): void {
  globalThis.__asterHrImportMemory = undefined;
}
