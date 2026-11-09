import { buildCalendarEvents } from "@/domain/rules/calendar-events";
import { hasGlobalPeopleScope } from "@/domain/rules/permissions";
import type { CalendarEvent } from "@/domain/types/calendar";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import { createWorkOnHolidayService } from "@/application/services/work-on-holiday-service";
import { mockEmail } from "@/infrastructure/email/mock-email";
import type { EmailPort } from "@/infrastructure/email/types";

async function buildForEmployees(
  hr: HrRepository,
  email: EmailPort,
  month: string,
  employeeIds: string[],
  session: AuthSession,
) {
  const idSet = new Set(employeeIds);
  const year = Number(month.slice(0, 4));
  const wohService = createWorkOnHolidayService({ hr, email });
  const [allEmployees, leavesNested, twNested, holidays, wohAll, absencesAll] =
    await Promise.all([
      hr.listEmployees(),
      Promise.all(
        employeeIds.map((id) => hr.listLeaveRequests({ employeeId: id })),
      ),
      Promise.all(
        employeeIds.map((id) => hr.listTeleworkRequests({ employeeId: id })),
      ),
      wohService.listHolidays([year]),
      wohService.listVisible(session),
      Promise.all(
        employeeIds.map((id) => hr.listWorkAbsences({ employeeId: id })),
      ),
    ]);

  const leaves = leavesNested.flat().filter((l) => idSet.has(l.employeeId));
  const telework = twNested.flat().filter((t) => idSet.has(t.employeeId));
  const workOnHoliday = wohAll.filter((r) => idSet.has(r.employeeId));
  const workAbsences = absencesAll
    .flat()
    .filter((a) => idSet.has(a.employeeId));
  const employeesById = Object.fromEntries(allEmployees.map((e) => [e.id, e]));

  return buildCalendarEvents({
    month,
    leaves,
    telework,
    holidays,
    workOnHoliday,
    workAbsences,
    employeesById,
    viewerRole: session.role,
    viewerEmployeeId: session.employee.id,
    includeRejected: true,
  });
}

export function createCalendarService(deps: {
  hr: HrRepository;
  email?: EmailPort;
}) {
  const email = deps.email ?? mockEmail;
  return {
    async getEmployeeMonth(
      session: AuthSession,
      month: string,
    ): Promise<{ month: string; events: CalendarEvent[] }> {
      const events = await buildForEmployees(
        deps.hr,
        email,
        month,
        [session.employee.id],
        session,
      );
      return { month, events };
    },

    async getTeamMonth(
      session: AuthSession,
      month: string,
    ): Promise<{ month: string; events: CalendarEvent[] }> {
      if (!hasGlobalPeopleScope(session.role)) {
        const events = await buildForEmployees(
          deps.hr,
          email,
          month,
          [session.employee.id],
          session,
        );
        return { month, events };
      }

      const team = await deps.hr.listEmployees();
      const ids = [
        ...new Set([session.employee.id, ...team.map((e) => e.id)]),
      ];
      const events = await buildForEmployees(
        deps.hr,
        email,
        month,
        ids,
        session,
      );
      return { month, events };
    },
  };
}
