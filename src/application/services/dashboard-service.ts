import {
  canApproveRequests,
  canViewAllRequests,
  hasGlobalPeopleScope,
} from "@/domain/rules/permissions";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

export function createDashboardService(deps: { hr: HrRepository }) {
  return {
    async getOverview(session: AuthSession) {
      const balance = await deps.hr.getLeaveBalance(session.employee.id, 2026);
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
