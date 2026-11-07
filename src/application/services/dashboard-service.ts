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

      const pendingLeaves =
        session.role === "collaborateur"
          ? []
          : session.role === "admin_rh"
            ? await deps.hr.listLeaveRequests({ status: "en_attente_manager" })
            : (
                await deps.hr.listLeaveRequests({
                  managerId: session.employee.id,
                })
              ).filter((r) => r.status === "en_attente_manager");

      const pendingTelework =
        session.role === "collaborateur"
          ? []
          : (
              session.role === "admin_rh"
                ? await deps.hr.listTeleworkRequests()
                : await deps.hr.listTeleworkRequests({
                    managerId: session.employee.id,
                  })
            ).filter((r) => r.status === "en_attente_manager");

      const team =
        session.role === "collaborateur"
          ? []
          : session.role === "admin_rh"
            ? await deps.hr.listEmployees()
            : await deps.hr.listTeamMembers(session.employee.id);

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
        pendingApprovals: pendingLeaves.length + pendingTelework.length,
        pendingLeaves,
        pendingTelework,
        unreadNotifications: unread,
        notifications: notifications.slice(0, 5),
        teamSize: team.length,
      };
    },
  };
}
