import { expandDateRange, monthBounds } from "@/domain/rules/dates";
import { leaveTypeLabel } from "@/domain/rules/leave";
import type {
  CalendarEvent,
  CalendarEventTone,
} from "@/domain/types/calendar";
import type { Employee, LeaveRequest, TeleworkRequest } from "@/domain/types/hr";

function toneFor(
  kind: "leave" | "telework",
  status: LeaveRequest["status"],
): CalendarEventTone {
  if (status === "refusee" || status === "annulee") return "rejected";
  if (kind === "leave") {
    return status === "approuvee" ? "leave_approved" : "leave_pending";
  }
  return status === "approuvee" ? "telework_approved" : "telework_pending";
}

function nameOf(
  employeeId: string,
  employeesById: Record<string, Employee>,
): string | null {
  const emp = employeesById[employeeId];
  return emp ? `${emp.firstName} ${emp.lastName}` : null;
}

/** Génère les événements calendrier à partir des demandes existantes (pas de doublons persistés). */
export function buildCalendarEvents(input: {
  month: string;
  leaves: LeaveRequest[];
  telework: TeleworkRequest[];
  employeesById?: Record<string, Employee>;
  includeRejected?: boolean;
}): CalendarEvent[] {
  const { start, end } = monthBounds(input.month);
  const includeRejected = input.includeRejected ?? true;
  const employeesById = input.employeesById ?? {};
  const events: CalendarEvent[] = [];

  for (const leave of input.leaves) {
    if (
      leave.status === "brouillon" ||
      leave.status === "annulee" ||
      (!includeRejected && leave.status === "refusee")
    ) {
      continue;
    }
    if (
      !["approuvee", "en_attente_manager", "en_attente_rh", "soumise", "refusee"].includes(
        leave.status,
      )
    ) {
      continue;
    }

    for (const date of expandDateRange(leave.startDate, leave.endDate)) {
      if (date < start || date > end) continue;
      const tone = toneFor("leave", leave.status);
      const baseTitle = leaveTypeLabel(leave.type);
      events.push({
        id: `${leave.id}:${date}`,
        date,
        kind: "leave",
        tone,
        status: leave.status,
        title:
          tone === "rejected"
            ? `${baseTitle} (refusé)`
            : tone === "leave_pending"
              ? `${baseTitle} (en attente)`
              : baseTitle,
        subtitle: null,
        employeeId: leave.employeeId,
        employeeName: nameOf(leave.employeeId, employeesById),
        sourceRequestId: leave.id,
      });
    }
  }

  for (const plan of input.telework) {
    if (
      plan.status === "brouillon" ||
      plan.status === "annulee" ||
      (!includeRejected && plan.status === "refusee")
    ) {
      continue;
    }
    for (const date of plan.days) {
      if (date < start || date > end) continue;
      const tone = toneFor("telework", plan.status);
      const baseTitle = plan.month
        ? `Télétravail (${plan.month})`
        : "Télétravail";
      events.push({
        id: `${plan.id}:${date}`,
        date,
        kind: "telework",
        tone,
        status: plan.status,
        title:
          tone === "rejected"
            ? `${baseTitle} — non confirmé`
            : tone === "telework_pending"
              ? `${baseTitle} (en attente)`
              : baseTitle,
        subtitle: plan.managerComment,
        employeeId: plan.employeeId,
        employeeName: nameOf(plan.employeeId, employeesById),
        sourceRequestId: plan.id,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function eventsByDate(
  events: CalendarEvent[],
): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    map[event.date] = [...(map[event.date] ?? []), event];
  }
  return map;
}
