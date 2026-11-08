import { buildCalendarEvents } from "@/domain/rules/calendar-events";
import { hasGlobalPeopleScope } from "@/domain/rules/permissions";
import type { CalendarEvent } from "@/domain/types/calendar";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

async function buildForEmployees(
  hr: HrRepository,
  month: string,
  employeeIds: string[],
) {
  const idSet = new Set(employeeIds);
  const [allEmployees, leavesNested, twNested] = await Promise.all([
    hr.listEmployees(),
    Promise.all(
      employeeIds.map((id) => hr.listLeaveRequests({ employeeId: id })),
    ),
    Promise.all(
      employeeIds.map((id) => hr.listTeleworkRequests({ employeeId: id })),
    ),
  ]);

  const leaves = leavesNested.flat().filter((l) => idSet.has(l.employeeId));
  const telework = twNested.flat().filter((t) => idSet.has(t.employeeId));
  const employeesById = Object.fromEntries(allEmployees.map((e) => [e.id, e]));

  return buildCalendarEvents({
    month,
    leaves,
    telework,
    employeesById,
    includeRejected: true,
  });
}

export function createCalendarService(deps: { hr: HrRepository }) {
  return {
    async getEmployeeMonth(
      session: AuthSession,
      month: string,
    ): Promise<{ month: string; events: CalendarEvent[] }> {
      const events = await buildForEmployees(deps.hr, month, [
        session.employee.id,
      ]);
      return { month, events };
    },

    async getTeamMonth(
      session: AuthSession,
      month: string,
    ): Promise<{ month: string; events: CalendarEvent[] }> {
      if (!hasGlobalPeopleScope(session.role)) {
        const events = await buildForEmployees(deps.hr, month, [
          session.employee.id,
        ]);
        return { month, events };
      }

      const team = await deps.hr.listEmployees();
      const ids = [
        ...new Set([session.employee.id, ...team.map((e) => e.id)]),
      ];
      const events = await buildForEmployees(deps.hr, month, ids);
      return { month, events };
    },
  };
}
