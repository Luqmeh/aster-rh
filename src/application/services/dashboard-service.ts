import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import {
  canApproveRequests,
  canViewAllRequests,
  hasGlobalPeopleScope,
} from "@/domain/rules/permissions";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

export function createDashboardService(deps: { hr: HrRepository }) {
  const ledger = createLeaveLedgerService({ hr: deps.hr });
  return {
    async getOverview(session: AuthSession) {
      const snaps = await ledger.getEmployeeBalances(
        session,
        session.employee.id,
        2026,
      );
      const balance = {
        employeeId: session.employee.id,
        year: 2026,
        congesPayesAcquis:
          snaps.conges_payes.totalCredited +
          (snaps.conges_payes_acquis?.totalCredited ?? 0) +
          (snaps.conges_payes_en_acquisition?.totalCredited ?? 0),
        congesPayesPris:
          snaps.conges_payes.totalConsumed +
          (snaps.conges_payes_acquis?.totalConsumed ?? 0) +
          (snaps.conges_payes_en_acquisition?.totalConsumed ?? 0),
        congesPayesRestants:
          snaps.conges_payes.ledgerBalance +
          (snaps.conges_payes_acquis?.ledgerBalance ?? 0) +
          (snaps.conges_payes_en_acquisition?.ledgerBalance ?? 0),
        rttAcquis: snaps.rtt.totalCredited,
        rttPris: snaps.rtt.totalConsumed,
        rttRestants: snaps.rtt.ledgerBalance,
        recoveryDaysAcquis: snaps.recuperation.totalCredited,
        recoveryDaysPris: snaps.recuperation.totalConsumed,
        recoveryDaysRestants: snaps.recuperation.ledgerBalance,
      };
      const myLeaves = await deps.hr.listLeaveRequests({
        employeeId: session.employee.id,
      });
      const myTelework = await deps.hr.listTeleworkRequests({
        employeeId: session.employee.id,
      });
      const notifications = await deps.hr.listNotifications(
        session.employee.id,
      );
      const unread = notifications.filter((n) => !n.read).length;

      const pendingLeaves = canViewAllRequests(session.role)
        ? (await deps.hr.listLeaveRequests()).filter(
            (r) =>
              r.status === "en_attente_manager" ||
              r.status === "en_attente_rh",
          )
        : [];

      const pendingTelework = canViewAllRequests(session.role)
        ? (await deps.hr.listTeleworkRequests()).filter(
            (r) =>
              r.status === "en_attente_manager" ||
              r.status === "en_attente_rh",
          )
        : [];

      const team = hasGlobalPeopleScope(session.role)
        ? await deps.hr.listEmployees()
        : [];

      return {
        employee: session.employee,
        role: session.role,
        balance,
        myLeavesOpen: myLeaves.filter((r) =>
          ["en_attente_manager", "en_attente_rh", "soumise"].includes(r.status),
        ).length,
        myTeleworkOpen: myTelework.filter((r) =>
          ["en_attente_manager", "en_attente_rh", "soumise"].includes(r.status),
        ).length,
        pendingApprovals: canApproveRequests(session.role)
          ? pendingLeaves.length + pendingTelework.length
          : 0,
        pendingLeaves,
        pendingTelework,
        unreadNotifications: unread,
        notifications: notifications.slice(0, 5),
        teamSize: team.length,
        canApprove: canApproveRequests(session.role),
        canViewRequests: canViewAllRequests(session.role),
      };
    },
  };
}
