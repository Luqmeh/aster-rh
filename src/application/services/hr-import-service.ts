import { randomBytes } from "crypto";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import {
  autoDetectColumnMapping,
  parseExcelWorkbook,
  pickBalanceSheet,
  pickEmployeeSheet,
  type ParsedWorkbook,
} from "@/domain/rules/hr-import/parse";
import { loadOfficialHrImportTemplateBytes } from "@/domain/rules/hr-import/templates";
import {
  buildPreviewSummary,
  validateBalanceRows,
  validateEmployeeRows,
} from "@/domain/rules/hr-import/validate";
import {
  canExecuteHrImport,
  canProvisionEmployees,
  canViewHrImport,
} from "@/domain/rules/permissions";
import type {
  HrImportBatch,
  HrImportExecutionReport,
  HrImportPreviewSummary,
  HrImportProvisioningResult,
} from "@/domain/types/hr-import";
import {
  HR_IMPORT_OPENING_SOURCE_KIND,
  HR_IMPORT_TEMPLATE_VERSION,
  HR_IMPORT_TYPE_EMPLOYEES_BALANCES,
  canCancelImportBatch,
  canRetryImportExecution,
  importOpeningSourceId,
  isPendingImportEmail,
  isTerminalImportStatus,
} from "@/domain/types/hr-import";
import type { ContractType, Employee, EmploymentStatus } from "@/domain/types/hr";
import { matchEmployeeForPeopleManager } from "@/domain/rules/people-manager";
import {
  createUserAccount,
  findAccountByEmail,
  findAccountByEmployeeId,
  updateUserAccount,
} from "@/infrastructure/auth/account-store";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { hashPassword } from "@/infrastructure/auth/password";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { EmailPort } from "@/infrastructure/email/types";
import {
  claimHrImportBatchExecution,
  deleteHrImportWorkbook,
  getHrImportBatch,
  getHrImportWorkbook,
  listHrImportBatches,
  putHrImportWorkbook,
  resetHrImportWorkbookCacheForTests,
  saveHrImportBatch,
} from "@/infrastructure/persistence/hr-import-batch-store";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import { createStyledWorkbook } from "@/infrastructure/reporting/excel-workbook";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ParseCache = {
  parsed: Map<string, ParsedWorkbook>;
};

declare global {
  var __asterHrImportParseCache: ParseCache | undefined;
}

function parseCache(): ParseCache {
  if (!globalThis.__asterHrImportParseCache) {
    globalThis.__asterHrImportParseCache = { parsed: new Map() };
  }
  return globalThis.__asterHrImportParseCache;
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

function generateTemporaryPassword(): string {
  return `Aster-${randomBytes(9).toString("base64url")}`;
}

/** Résout ou crée une entrée People Manager à partir du texte importé. */
async function resolveImportPeopleManager(
  hr: HrRepository,
  raw: string | null,
): Promise<{ id: string; linkedEmployeeId: string | null } | null> {
  const name = (raw ?? "").trim();
  if (!name) return null;

  const catalog = await hr.listPeopleManagers({ includeInactive: true });
  const existing = catalog.find(
    (p) => p.displayName.toLowerCase() === name.toLowerCase() && p.isActive,
  );
  if (existing) {
    return { id: existing.id, linkedEmployeeId: existing.linkedEmployeeId };
  }

  const employees = await hr.listEmployees({ includeInactive: true });
  const linked = matchEmployeeForPeopleManager(employees, name);
  const created = await hr.createPeopleManager({
    displayName: linked
      ? `${linked.firstName} ${linked.lastName}`.trim()
      : name,
    linkedEmployeeId: linked?.id ?? null,
  });
  return { id: created.id, linkedEmployeeId: created.linkedEmployeeId };
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
  email?: EmailPort | null;
}) {
  const leaveLedger = createLeaveLedgerService({ hr: deps.hr });

  async function loadParsed(batch: HrImportBatch): Promise<ParsedWorkbook> {
    const cached = parseCache().parsed.get(batch.id);
    if (cached) return cached;

    let bytes = await getHrImportWorkbook(batch.id);
    if (!bytes && batch.storageKey && deps.storage?.getObject) {
      bytes = await deps.storage.getObject(batch.storageKey);
      if (bytes) await putHrImportWorkbook(batch.id, bytes);
    }
    if (!bytes) {
      throw new Error(
        "Fichier source indisponible après redémarrage — réimportez le classeur ou vérifiez le stockage privé.",
      );
    }
    const parsed = await parseExcelWorkbook(bytes);
    parseCache().parsed.set(batch.id, parsed);
    return parsed;
  }

  async function provisionAccountForImport(input: {
    session: AuthSession;
    employeeId: string;
    email: string;
    firstName: string;
    emailMissing: boolean;
  }): Promise<HrImportProvisioningResult> {
    const base = {
      matricule: input.employeeId,
      employeeId: input.employeeId,
      email: input.emailMissing ? null : input.email,
    };

    if (input.emailMissing || isPendingImportEmail(input.email)) {
      return {
        ...base,
        status: "pending",
        message:
          "Pas d'e-mail professionnel — compte ASTER en attente de provisioning RH.",
      };
    }

    if (!canProvisionEmployees(input.session.role)) {
      return {
        ...base,
        status: "failed",
        message: "Provisioning compte refusé — droits insuffisants.",
      };
    }

    const existingByEmployee = await findAccountByEmployeeId(input.employeeId);
    if (existingByEmployee) {
      return {
        ...base,
        status: "already_existing",
        message: "Compte déjà lié — identifiants non modifiés.",
      };
    }
    const existingByEmail = await findAccountByEmail(input.email);
    if (existingByEmail) {
      return {
        ...base,
        status: "already_existing",
        message: "Compte existant pour cet e-mail — non écrasé.",
      };
    }

    try {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      const account = await createUserAccount({
        email: input.email,
        passwordHash,
        authProvider: "credentials",
        role: "collaborateur",
        employeeId: input.employeeId,
        isActive: true,
        mustChangePassword: true,
      });
      await deps.hr.addRoleChangeAudit({
        targetAccountId: account.id,
        previousRole: "collaborateur",
        newRole: "collaborateur",
        actorEmployeeId: input.session.employee.id,
      });
      if (deps.email) {
        await deps.email.send({
          to: input.email,
          subject: "[ASTER] Compte collaborateur provisionné (import Excel)",
          body: `Bonjour ${input.firstName},\n\nVotre compte ASTER a été créé suite à un import RH.\nIdentifiant : ${input.email}\nMot de passe temporaire : ${temporaryPassword}\n\nÀ la première connexion, vous devrez changer ce mot de passe.\nCe message ne constitue pas la création d'une boîte mail entreprise.`,
        });
      }
      return {
        ...base,
        status: "created",
        message:
          "Compte collaborateur créé (mustChangePassword) — mot de passe temporaire envoyé par e-mail uniquement.",
      };
    } catch (err) {
      return {
        ...base,
        status: "failed",
        message:
          err instanceof Error
            ? err.message
            : "Échec de provisioning du compte.",
      };
    }
  }

  return {
    async downloadTemplate(session: AuthSession) {
      assertCanView(session);
      const buffer = loadOfficialHrImportTemplateBytes();
      return {
        buffer,
        rowCount: 0,
        fileName: "ASTER_Modele_Import_RH_Maroc.xlsx",
      };
    },

    async downloadExecutionReport(session: AuthSession, batchId: string) {
      assertCanView(session);
      const batch = await getHrImportBatch(batchId);
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
          accountsCreated: report.accountsCreated,
          rejectedRows: report.rejectedRows,
          warningRows: report.warningRows,
        },
      }));
    },

    async listBatches(session: AuthSession): Promise<HrImportBatch[]> {
      assertCanView(session);
      return listHrImportBatches();
    },

    async getBatch(
      session: AuthSession,
      batchId: string,
    ): Promise<HrImportBatch | null> {
      assertCanView(session);
      return getHrImportBatch(batchId);
    },

    async uploadWorkbook(
      session: AuthSession,
      input: { fileName: string; bytes: Uint8Array },
    ): Promise<HrImportBatch> {
      assertCanExecute(session);
      if (!input.fileName.toLowerCase().endsWith(".xlsx")) {
        throw new Error("Seuls les fichiers .xlsx sont acceptés.");
      }
      if (
        input.bytes.byteLength === 0 ||
        input.bytes.byteLength > MAX_UPLOAD_BYTES
      ) {
        throw new Error("Fichier vide ou supérieur à 5 Mo.");
      }

      const parsed = await parseExcelWorkbook(input.bytes);
      const batchId = newId("imp");
      let storageKey: string | null = null;
      if (deps.storage) {
        const key = `imports/private/${batchId}/${input.fileName.replace(/[^\w.\-]+/g, "_")}`;
        await deps.storage.putObject(key, input.bytes, XLSX_TYPE);
        storageKey = key;
      }
      await putHrImportWorkbook(batchId, input.bytes);
      parseCache().parsed.set(batchId, parsed);

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
        importType: HR_IMPORT_TYPE_EMPLOYEES_BALANCES,
        templateVersion: HR_IMPORT_TEMPLATE_VERSION,
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
        totalRows: 0,
        validRows: 0,
        warningRows: 0,
        rejectedRows: 0,
        employeesCreated: 0,
        employeesUpdated: 0,
        balancesImported: 0,
        accountsCreated: 0,
        accountsExisting: 0,
        accountsPending: 0,
        accountsFailed: 0,
        failureSummary: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        validatedAt: null,
        executionStartedAt: null,
        executedAt: null,
      };
      return saveHrImportBatch(batch);
    },

    async validateBatch(
      session: AuthSession,
      input: {
        batchId: string;
        updateExistingEmployees?: boolean;
        columnMapping?: Record<string, string>;
        departmentMapping?: Record<string, string>;
      },
    ): Promise<HrImportBatch> {
      assertCanExecute(session);
      const existing = await getHrImportBatch(input.batchId);
      if (!existing) throw new AuthError("Lot d'import introuvable.", 404);
      if (isTerminalImportStatus(existing.status) || existing.status === "executing") {
        throw new Error("Ce lot est déjà exécuté ou en cours.");
      }

      let batch = await saveHrImportBatch({
        ...existing,
        status: "validating",
        errorMessage: null,
      });

      const parsed = await loadParsed(batch);

      if (input.updateExistingEmployees != null) {
        batch.updateExistingEmployees = input.updateExistingEmployees;
      }
      if (input.columnMapping) batch.columnMappingJson = input.columnMapping;
      if (input.departmentMapping) {
        batch.departmentMappingJson = input.departmentMapping;
      }

      const [departments, employees] = await Promise.all([
        deps.hr.listDepartments(),
        deps.hr.listEmployees({ includeInactive: true }),
      ]);
      const empSheet = pickEmployeeSheet(parsed.worksheets);
      const balSheet = pickBalanceSheet(parsed.worksheets);

      const employeeDrafts = empSheet
        ? validateEmployeeRows({
            rows: empSheet.rows,
            mapping: batch.columnMappingJson,
            departmentMapping: batch.departmentMappingJson,
            departments,
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

      const previewSummary = buildPreviewSummary(employeeDrafts, balanceDrafts);
      const hasBlockingErrors =
        employeeDrafts.some((d) => d.severity === "error") ||
        balanceDrafts.some((d) => d.severity === "error");
      const now = new Date().toISOString();
      batch = {
        ...batch,
        employeeDrafts,
        balanceDrafts,
        previewSummary,
        // Ne pas ouvrir la confirmation tant que des lignes restent en erreur
        // (sinon l'UI propose IMPORTER puis throw → React #441 en production).
        status: hasBlockingErrors ? "validated" : "awaiting_confirmation",
        validatedAt: now,
        updatedAt: now,
        errorMessage: hasBlockingErrors
          ? "Des lignes invalides restent présentes — corrigez le fichier ou retirez-les."
          : null,
        failureSummary: null,
      };
      return saveHrImportBatch(batch);
    },

    /**
     * Interrompu (executing) → failed pour inspection / retry sûr.
     * Aucun retry automatique d'écritures ledger.
     */
    async recoverInterruptedBatch(
      session: AuthSession,
      batchId: string,
    ): Promise<HrImportBatch> {
      assertCanExecute(session);
      const batch = await getHrImportBatch(batchId);
      if (!batch) throw new AuthError("Lot d'import introuvable.", 404);
      if (batch.status !== "executing") {
        throw new Error("Seuls les lots en cours (executing) peuvent être récupérés.");
      }
      const now = new Date().toISOString();
      return saveHrImportBatch({
        ...batch,
        status: "failed",
        failureSummary:
          "Import interrompu — marqué failed pour reprise manuelle contrôlée.",
        errorMessage:
          "Exécution interrompue. Relancez après inspection (idempotence ledger / comptes).",
        updatedAt: now,
      });
    },

    /**
     * Abandonne un lot non exécuté : statut cancelled, purge du classeur temporaire.
     * N'écrit jamais employés / comptes / ledger. Idempotent si déjà cancelled.
     */
    async cancelBatch(
      session: AuthSession,
      batchId: string,
    ): Promise<HrImportBatch> {
      assertCanExecute(session);
      const existing = await getHrImportBatch(batchId);
      if (!existing) throw new AuthError("Lot d'import introuvable.", 404);

      if (existing.status === "cancelled") {
        return existing;
      }
      if (existing.status === "executing") {
        throw new Error(
          "Lot en cours d'exécution — abandon impossible. Utilisez la récupération si bloqué.",
        );
      }
      if (
        existing.status === "completed" ||
        existing.status === "completed_with_errors"
      ) {
        throw new Error("Lot déjà exécuté — abandon impossible.");
      }
      if (!canCancelImportBatch(existing.status)) {
        throw new Error("Ce lot ne peut pas être abandonné.");
      }

      const storageKey = existing.storageKey;
      if (storageKey && deps.storage?.deleteObject) {
        try {
          await deps.storage.deleteObject(storageKey);
        } catch {
          // La purge stockage est best-effort ; l'audit lot reste prioritaire.
        }
      }
      parseCache().parsed.delete(existing.id);
      await deleteHrImportWorkbook(existing.id);

      const now = new Date().toISOString();
      return saveHrImportBatch({
        ...existing,
        status: "cancelled",
        storageKey: null,
        // Purge des brouillons nominatifs ; conserve le résumé pour l'audit.
        employeeDrafts: [],
        balanceDrafts: [],
        headersBySheet: {},
        failureSummary: "Import abandonné par RH avant exécution.",
        errorMessage:
          "Import abandonné — aucun collaborateur, compte ni solde créé.",
        updatedAt: now,
      });
    },

    async confirmAndExecute(
      session: AuthSession,
      input: { batchId: string; confirmationPhrase: string },
    ): Promise<HrImportBatch> {
      assertCanExecute(session);
      const existing = await getHrImportBatch(input.batchId);
      if (!existing) throw new AuthError("Lot d'import introuvable.", 404);
      if (existing.status === "cancelled") {
        throw new Error("Lot abandonné — exécution refusée.");
      }
      if (isTerminalImportStatus(existing.status)) {
        throw new Error("Lot déjà exécuté — réexécution refusée (idempotence).");
      }
      if (existing.status === "executing") {
        throw new Error(
          "Exécution déjà en cours — utilisez la récupération si le lot est bloqué.",
        );
      }
      if (
        existing.status === "validated" ||
        existing.employeeDrafts.some((e) => e.severity === "error") ||
        existing.balanceDrafts.some((b) => b.severity === "error")
      ) {
        throw new Error(
          "Des lignes invalides restent présentes — corrigez le fichier ou retirez-les.",
        );
      }
      if (!canRetryImportExecution(existing.status)) {
        throw new Error("Validez d'abord le lot (prévisualisation).");
      }
      if (input.confirmationPhrase.trim().toUpperCase() !== "IMPORTER") {
        throw new Error(
          'Confirmation requise : saisissez exactement « IMPORTER ».',
        );
      }

      const claimed = await claimHrImportBatchExecution(existing.id, [
        "awaiting_confirmation",
        "failed",
      ]);
      if (!claimed) {
        throw new Error(
          "Impossible de démarrer l'exécution (concurrence ou statut incompatible).",
        );
      }

      try {
        const report = await this.executeBatch(session, claimed);
        const hasProvisioningFailures = report.accountsFailed > 0;
        const hasManual = report.manualIntervention.length > 0;
        const status =
          hasProvisioningFailures || hasManual
            ? "completed_with_errors"
            : "completed";
        const done = await saveHrImportBatch({
          ...claimed,
          executionReport: report,
          status,
          confirmedByEmployeeId: session.employee.id,
          executedAt: report.executedAt,
          updatedAt: report.executedAt,
          employeesCreated: report.employeesCreated,
          employeesUpdated: report.employeesUpdated,
          balancesImported: report.balancesImported,
          accountsCreated: report.accountsCreated,
          accountsExisting: report.accountsExisting,
          accountsPending: report.accountsPending,
          accountsFailed: report.accountsFailed,
          failureSummary: hasManual
            ? report.manualIntervention.slice(0, 20).join(" | ")
            : null,
          errorMessage: null,
        });
        parseCache().parsed.delete(done.id);
        await deleteHrImportWorkbook(done.id);
        return done;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Échec d'exécution.";
        await saveHrImportBatch({
          ...claimed,
          status: "failed",
          errorMessage: message,
          failureSummary: message,
          updatedAt: new Date().toISOString(),
        });
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
      const provisioningResults: HrImportProvisioningResult[] = [];

      for (const draft of batch.employeeDrafts) {
        if (draft.severity === "error") continue;
        if (draft.action === "create") {
          const existing = await deps.hr.getEmployee(draft.matricule);
          if (existing) {
            createdIds.add(draft.matricule);
            manual.push(
              `Collaborateur ${draft.matricule} déjà présent — création ignorée (reprise).`,
            );
            const prov = await provisionAccountForImport({
              session,
              employeeId: draft.matricule,
              email: draft.email,
              firstName: draft.firstName,
              emailMissing: draft.emailMissing,
            });
            provisioningResults.push(prov);
            continue;
          }
          const initials = `${draft.firstName[0] ?? ""}${draft.lastName[0] ?? ""}`
            .toUpperCase()
            .slice(0, 2);
          const pm = await resolveImportPeopleManager(
            deps.hr,
            draft.peopleManagerRaw,
          );
          await deps.hr.createEmployee({
            id: draft.matricule,
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.email,
            jobTitle: "",
            departmentId: null,
            peopleManagerId: pm?.id ?? null,
            managerId: pm?.linkedEmployeeId ?? null,
            region: draft.region!,
            contractType: draft.contractType as ContractType,
            grade: draft.grade as Employee["grade"],
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
          provisioningResults.push(
            await provisionAccountForImport({
              session,
              employeeId: draft.matricule,
              email: draft.email,
              firstName: draft.firstName,
              emailMissing: draft.emailMissing,
            }),
          );
        } else if (draft.action === "update" && draft.existingEmployeeId) {
          // Colonne People Manager vide : on conserve l'affectation existante.
          const pm = await resolveImportPeopleManager(
            deps.hr,
            draft.peopleManagerRaw,
          );
          await deps.hr.updateEmployee(draft.existingEmployeeId, {
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.emailMissing
              ? undefined
              : draft.email,
            jobTitle: "",
            departmentId: null,
            ...(pm
              ? {
                  peopleManagerId: pm.id,
                  managerId: pm.linkedEmployeeId,
                }
              : {}),
            region: draft.region ?? undefined,
            grade: (draft.grade as Employee["grade"]) ?? undefined,
            contractType: draft.contractType as ContractType,
            hireDate: draft.hireDate ?? undefined,
            employmentStatus: draft.employmentStatus as EmploymentStatus,
          });
          updated += 1;
          provisioningResults.push({
            matricule: draft.matricule,
            employeeId: draft.existingEmployeeId,
            email: draft.emailMissing ? null : draft.email,
            status: "skipped",
            message:
              "Mise à jour fiche uniquement — credentials de compte non modifiés.",
          });
        }
      }

      const reconciliation: HrImportExecutionReport["reconciliation"] = [];

      for (const bal of batch.balanceDrafts) {
        if (bal.severity === "error" || !bal.matricule || !bal.effectiveDate) {
          continue;
        }
        const employee = await deps.hr.getEmployee(bal.matricule);
        if (!employee) {
          manual.push(
            `Solde ignoré — ${bal.matricule} introuvable à l'exécution.`,
          );
          continue;
        }
        const year = Number(bal.effectiveDate.slice(0, 4)) || 2026;
        const accounts: Array<{
          account: "conges_payes" | "rtt" | "recuperation";
          qty: number;
          unit: "days" | "hours";
        }> = [];
        if (bal.cpDays != null && bal.cpDays !== 0) {
          accounts.push({ account: "conges_payes", qty: bal.cpDays, unit: "days" });
        }
        if (bal.rttDays != null && bal.rttDays !== 0) {
          accounts.push({ account: "rtt", qty: bal.rttDays, unit: "days" });
        }
        if (bal.recoveryHours != null && bal.recoveryHours !== 0) {
          // Modèle officiel : heures exactes, sans conversion silencieuse en jours.
          accounts.push({
            account: "recuperation",
            qty: bal.recoveryHours,
            unit: "hours",
          });
        } else if (bal.recoveryDays != null && bal.recoveryDays !== 0) {
          accounts.push({
            account: "recuperation",
            qty: bal.recoveryDays,
            unit: "days",
          });
        }

        for (const { account, qty, unit } of accounts) {
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
              unit,
              year,
              effectiveDate: bal.effectiveDate,
              sourceKind: HR_IMPORT_OPENING_SOURCE_KIND,
              sourceId,
              reason: `Ouverture Excel (${bal.sourceReference || "import RH"}) — lot ${batch.id}.`,
              actorEmployeeId: session.employee.id,
              metadataJson: {
                importBatchId: batch.id,
                matricule: bal.matricule,
                balanceType: bal.balanceType,
                balanceUnit: bal.balanceUnit ?? unit,
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
        // Format long : une ligne Excel par type — agréger la réconciliation par matricule.
        const existingRecon = reconciliation.find(
          (r) => r.matricule === bal.matricule,
        );
        if (existingRecon) {
          if (bal.cpDays != null) existingRecon.excelCp = bal.cpDays;
          if (bal.rttDays != null) existingRecon.excelRtt = bal.rttDays;
          if (bal.recoveryDays != null) {
            existingRecon.excelRecoveryDays = bal.recoveryDays;
          }
          if (bal.recoveryHours != null) {
            existingRecon.excelRecoveryDays = bal.recoveryHours;
          }
          existingRecon.asterCp = snap?.ledgerBalance ?? existingRecon.asterCp;
          existingRecon.asterRtt = rtt?.ledgerBalance ?? existingRecon.asterRtt;
          existingRecon.asterRecoveryDays =
            rec?.ledgerBalance ?? existingRecon.asterRecoveryDays;
        } else {
          reconciliation.push({
            matricule: bal.matricule,
            employeeId: employee.id,
            excelCp: bal.cpDays,
            excelRtt: bal.rttDays,
            excelRecoveryDays: bal.recoveryHours ?? bal.recoveryDays,
            asterCp: snap?.ledgerBalance ?? null,
            asterRtt: rtt?.ledgerBalance ?? null,
            asterRecoveryDays: rec?.ledgerBalance ?? null,
          });
        }
      }

      const summary = batch.previewSummary ?? emptySummary();
      const accountsCreated = provisioningResults.filter(
        (p) => p.status === "created",
      ).length;
      const accountsExisting = provisioningResults.filter(
        (p) => p.status === "already_existing",
      ).length;
      const accountsPending = provisioningResults.filter(
        (p) => p.status === "pending",
      ).length;
      const accountsFailed = provisioningResults.filter(
        (p) => p.status === "failed",
      ).length;

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
        accountsCreated,
        accountsExisting,
        accountsPending,
        accountsFailed,
        provisioningResults,
        manualIntervention: manual,
        reconciliation,
      };
    },

    /**
     * Reprovisioning / reset explicite hors import (délègue au store comptes).
     * N'est jamais déclenché automatiquement par un ré-import.
     */
    async reprovisionImportedAccount(
      session: AuthSession,
      employeeId: string,
    ) {
      assertCanExecute(session);
      if (!canProvisionEmployees(session.role)) {
        throw new AuthError("Reprovisioning réservé aux Ressources humaines.", 403);
      }
      const employee = await deps.hr.getEmployee(employeeId);
      if (!employee) throw new AuthError("Collaborateur introuvable.", 404);
      if (isPendingImportEmail(employee.email)) {
        throw new Error(
          "E-mail professionnel manquant — renseignez l'adresse avant de provisionner.",
        );
      }
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      let account = await findAccountByEmployeeId(employeeId);
      if (!account) {
        account = await createUserAccount({
          email: employee.email,
          passwordHash,
          authProvider: "credentials",
          role: "collaborateur",
          employeeId,
          isActive: true,
          mustChangePassword: true,
        });
      } else {
        if (account.role !== "collaborateur") {
          throw new AuthError(
            "Refus : le reset import ne s'applique qu'aux comptes collaborateur.",
            403,
          );
        }
        account = await updateUserAccount(account.id, {
          passwordHash,
          mustChangePassword: true,
        });
      }
      await deps.hr.addRoleChangeAudit({
        targetAccountId: account.id,
        previousRole: account.role,
        newRole: "collaborateur",
        actorEmployeeId: session.employee.id,
      });
      if (deps.email) {
        await deps.email.send({
          to: employee.email,
          subject: "[ASTER] Mot de passe temporaire régénéré",
          body: `Bonjour ${employee.firstName},\n\nUn mot de passe temporaire a été régénéré par les RH.\nIdentifiant : ${employee.email}\nMot de passe temporaire : ${temporaryPassword}\n\nChangez-le à la prochaine connexion.`,
        });
      }
      return {
        employeeId,
        accountId: account.id,
        mustChangePassword: true,
        // plaintext only returned to authenticated RH caller for one-time display
        temporaryPassword,
      };
    },
  };
}

export type HrImportService = ReturnType<typeof createHrImportService>;

export function resetHrImportMemoryForTests(): void {
  globalThis.__asterHrImportParseCache = undefined;
  resetHrImportWorkbookCacheForTests();
}
