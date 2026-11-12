import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import {
  buildLeaveBalanceContextFromLedger,
  buildLeaveHistoryEntries,
  selectLastCompletedWorkAbsence,
  selectLastTakenLeave,
  sumSpecialLeaveDaysUsedThisYear,
  type LeaveBalanceContext,
  type LeaveHistoryEntry,
  type WorkAbsenceHistoryEntry,
} from "@/domain/rules/leave-approval-context";
import { employmentStatusLabel } from "@/domain/rules/lifecycle";
import {
  canApproveRequests,
  canViewAllRequests,
  canViewAllWorkAbsences,
  canViewWorkAbsenceMedicalDocs,
} from "@/domain/rules/permissions";
import { moroccoToday } from "@/domain/rules/reporting";
import {
  evaluateSpecialLeaveEntitlement,
  getSpecialLeaveEntitlement,
} from "@/domain/rules/special-leave-entitlements";
import {
  familyForCategory,
  workAbsenceCategoryLabel,
} from "@/domain/rules/work-absence";
import { employeeGradeLabel } from "@/domain/types/employee-structure";
import type {
  Employee,
  LeaveRequest,
  RecoveryCreditLedgerEntry,
  WorkAbsence,
} from "@/domain/types/hr";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

const DEFAULT_YEAR = 2026;

export type EmployeeOverviewContext = {
  employeeId: string;
  fullName: string;
  gradeLabel: string;
  region: string;
  employmentStatus: string;
  employmentStatusCode: Employee["employmentStatus"];
  profileHref: string;
};

export type RecoveryCreditContext = {
  hoursConfirmedTotal: number;
  daysCreditedTotal: number;
  balanceAcquis: number | null;
  balancePris: number | null;
  balanceRestants: number | null;
  entriesCount: number;
};

export type SpecialLeaveContext = {
  categoryLabel: string;
  maxDays: number | null;
  usedDaysThisYear: number;
  requestDays: number;
  projectedUsedAfterApproval: number;
  requiresHrReview: boolean;
  message: string | null;
  source: "guide_p46" | "guide_p45_47" | "hypothese_demo" | null;
};

export type LeaveRequestApprovalContext = {
  kind: "leave_request";
  requestId: string;
  employee: EmployeeOverviewContext;
  balance: LeaveBalanceContext;
  lastTaken: LeaveHistoryEntry | null;
  history: LeaveHistoryEntry[];
  recovery: RecoveryCreditContext | null;
  canDecide: boolean;
  viewerCanSeeMedical: boolean;
};

export type WorkAbsenceApprovalContext = {
  kind: "work_absence";
  absenceId: string;
  employee: EmployeeOverviewContext;
  family: WorkAbsence["family"];
  categoryLabel: string;
  /** Arrêts / spéciaux : pas de LeaveBalance CP/RTT. */
  balanceTracked: false;
  balanceLabel: "Solde non suivi";
  specialLeave: SpecialLeaveContext | null;
  lastCompleted: WorkAbsenceHistoryEntry | null;
  history: WorkAbsenceHistoryEntry[];
  returnVisitStatus: WorkAbsence["returnVisitStatus"] | null;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  /** Toujours false pour le Chef — exposé pour les tests d'isolation. */
  includesMedicalDocuments: boolean;
  includesMedicalDetails: boolean;
  canDecide: boolean;
};

function overviewFor(employee: Employee): EmployeeOverviewContext {
  return {
    employeeId: employee.id,
    fullName: `${employee.firstName} ${employee.lastName}`,
    gradeLabel: employeeGradeLabel(employee.grade),
    region: employee.region,
    employmentStatus: employmentStatusLabel(employee.employmentStatus),
    employmentStatusCode: employee.employmentStatus,
    profileHref: `/annuaire/${employee.id}`,
  };
}

function assertViewerCanSeePeopleContext(session: AuthSession): void {
  if (!canViewAllRequests(session.role) && !canViewAllWorkAbsences(session.role)) {
    throw new AuthError(
      "Contexte collaborateur réservé aux rôles Chef de projet et RH.",
      403,
    );
  }
}

export function createLeaveApprovalContextService(deps: { hr: HrRepository }) {
  const ledger = createLeaveLedgerService({ hr: deps.hr });

  return {
    /**
     * Construit le contexte pour une file de congés (batch, anti N+1).
     */
    async getLeaveRequestContexts(
      session: AuthSession,
      requests: LeaveRequest[],
      year = DEFAULT_YEAR,
    ): Promise<Record<string, LeaveRequestApprovalContext>> {
      requireSession(session);
      assertViewerCanSeePeopleContext(session);
      if (requests.length === 0) return {};

      await ledger.ensureBackfill(year);

      const [employees, allLeaves] = await Promise.all([
        deps.hr.listEmployees({ includeInactive: true }),
        deps.hr.listLeaveRequests(),
      ]);
      const empById = new Map(employees.map((e) => [e.id, e]));
      const leavesByEmployee = new Map<string, LeaveRequest[]>();
      for (const leave of allLeaves) {
        const list = leavesByEmployee.get(leave.employeeId) ?? [];
        list.push(leave);
        leavesByEmployee.set(leave.employeeId, list);
      }

      const employeeIds = [...new Set(requests.map((r) => r.employeeId))];

      const recoveryNeeded = employeeIds.filter((id) =>
        requests.some(
          (r) => r.employeeId === id && r.type === "recuperation",
        ),
      );
      const recoveryEntries = await Promise.all(
        recoveryNeeded.map(async (id) => {
          const entries = await deps.hr.listRecoveryCredits(id);
          return [id, entries] as const;
        }),
      );
      const recoveryById = new Map(recoveryEntries);

      const asOf = moroccoToday();
      const canDecide = canApproveRequests(session.role);
      const viewerCanSeeMedical = canViewWorkAbsenceMedicalDocs(session.role);
      const result: Record<string, LeaveRequestApprovalContext> = {};

      for (const request of requests) {
        const employee = empById.get(request.employeeId);
        if (!employee) continue;
        const employeeLeaves = leavesByEmployee.get(request.employeeId) ?? [];
        const snapshot = await ledger.getBalanceForLeaveType(
          session,
          request.employeeId,
          request.type,
          year,
          request,
        );
        const balanceCtx = buildLeaveBalanceContextFromLedger({
          snapshot,
          leaveType: request.type,
          employeeRequests: employeeLeaves,
          currentRequest: request,
          year,
        });

        let recovery: RecoveryCreditContext | null = null;
        if (request.type === "recuperation") {
          const entries = recoveryById.get(request.employeeId) ?? [];
          const yearEntries = entries.filter((e) => e.year === year);
          recovery = {
            hoursConfirmedTotal: yearEntries.reduce(
              (s, e) => s + e.hoursConfirmed,
              0,
            ),
            daysCreditedTotal: yearEntries.reduce(
              (s, e) => s + e.daysCredited,
              0,
            ),
            balanceAcquis: snapshot?.totalCredited ?? null,
            balancePris: snapshot?.totalConsumed ?? null,
            balanceRestants: snapshot?.ledgerBalance ?? null,
            entriesCount: yearEntries.length,
          };
        }

        result[request.id] = {
          kind: "leave_request",
          requestId: request.id,
          employee: overviewFor(employee),
          balance: balanceCtx,
          lastTaken: selectLastTakenLeave(
            employeeLeaves.filter((r) => r.id !== request.id),
            request.type,
            asOf,
          ),
          history: buildLeaveHistoryEntries(employeeLeaves, {
            preferredType: request.type,
            excludeIds: [request.id],
            limit: 5,
            takenOnly: true,
          }),
          recovery,
          canDecide,
          viewerCanSeeMedical,
        };
      }

      return result;
    },

    async getLeaveRequestContext(
      session: AuthSession,
      requestId: string,
      year = DEFAULT_YEAR,
    ): Promise<LeaveRequestApprovalContext> {
      requireSession(session);
      assertViewerCanSeePeopleContext(session);
      const request = await deps.hr.getLeaveRequest(requestId);
      if (!request) throw new AuthError("Demande introuvable.", 404);
      const map = await this.getLeaveRequestContexts(session, [request], year);
      const ctx = map[request.id];
      if (!ctx) throw new AuthError("Collaborateur introuvable.", 404);
      return ctx;
    },

    async getWorkAbsenceContext(
      session: AuthSession,
      absenceId: string,
      year = DEFAULT_YEAR,
    ): Promise<WorkAbsenceApprovalContext> {
      requireSession(session);
      if (!canViewAllWorkAbsences(session.role)) {
        throw new AuthError(
          "Contexte d'absence réservé aux rôles Chef de projet et RH.",
          403,
        );
      }

      const absence = await deps.hr.getWorkAbsence(absenceId);
      if (!absence) throw new AuthError("Absence introuvable.", 404);

      const [employee, absences] = await Promise.all([
        deps.hr.getEmployee(absence.employeeId),
        deps.hr.listWorkAbsences({ employeeId: absence.employeeId }),
      ]);
      if (!employee) throw new AuthError("Collaborateur introuvable.", 404);

      const asOf = moroccoToday();
      const canSeeMedical = canViewWorkAbsenceMedicalDocs(session.role);

      let specialLeave: SpecialLeaveContext | null = null;
      if (familyForCategory(absence.category) === "conge_special") {
        const entitlement = getSpecialLeaveEntitlement(absence.category);
        const used = sumSpecialLeaveDaysUsedThisYear(
          absences,
          absence.category,
          year,
          absence.id,
        );
        const evaluation = evaluateSpecialLeaveEntitlement({
          category: absence.category,
          requestedDays: absence.daysCount,
          usedDaysThisYear: used,
          contractType: employee.contractType,
        });
        specialLeave = {
          categoryLabel: workAbsenceCategoryLabel(absence.category),
          maxDays: entitlement?.maxDays ?? null,
          usedDaysThisYear: used,
          requestDays: absence.daysCount,
          projectedUsedAfterApproval: used + absence.daysCount,
          requiresHrReview: evaluation.requiresHrReview,
          message: evaluation.message,
          source: entitlement?.source ?? null,
        };
      }

      const historyAbsences = absences
        .filter((a) => a.id !== absence.id)
        .filter((a) => a.status !== "refuse")
        .sort((a, b) => b.endDate.localeCompare(a.endDate))
        .slice(0, 5)
        .map(
          (a): WorkAbsenceHistoryEntry => ({
            id: a.id,
            category: a.category,
            startDate: a.startDate,
            endDate: a.endDate,
            daysCount: a.daysCount,
            status: a.status,
            family: a.family,
          }),
        );

      return {
        kind: "work_absence",
        absenceId: absence.id,
        employee: overviewFor(employee),
        family: absence.family,
        categoryLabel: workAbsenceCategoryLabel(absence.category),
        balanceTracked: false,
        balanceLabel: "Solde non suivi",
        specialLeave,
        lastCompleted: selectLastCompletedWorkAbsence(
          absences.filter((a) => a.id !== absence.id),
          absence.category,
          asOf,
        ),
        history: historyAbsences,
        returnVisitStatus:
          absence.family === "arret" ? absence.returnVisitStatus : null,
        expectedReturnDate: absence.expectedReturnDate,
        actualReturnDate: absence.actualReturnDate,
        includesMedicalDocuments: false,
        includesMedicalDetails: false,
        canDecide: false,
      };
      // Medical isolation: even HR context panel never embeds docs/diagnostics.
      // Download remains on the dedicated absence page for RH only (canSeeMedical).
      void canSeeMedical;
    },
  };
}

export type LeaveApprovalContextService = ReturnType<
  typeof createLeaveApprovalContextService
>;

/** Helper tests / reporting — agrège les crédits récupération. */
export function summarizeRecoveryCredits(
  entries: RecoveryCreditLedgerEntry[],
  year: number,
): Pick<
  RecoveryCreditContext,
  "hoursConfirmedTotal" | "daysCreditedTotal" | "entriesCount"
> {
  const yearEntries = entries.filter((e) => e.year === year);
  return {
    hoursConfirmedTotal: yearEntries.reduce((s, e) => s + e.hoursConfirmed, 0),
    daysCreditedTotal: yearEntries.reduce((s, e) => s + e.daysCredited, 0),
    entriesCount: yearEntries.length,
  };
}
