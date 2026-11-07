import type { RequestStatus } from "@/domain/types/hr";

export type CalendarEventKind = "leave" | "telework";

export type CalendarEventTone =
  | "leave_approved"
  | "leave_pending"
  | "telework_approved"
  | "telework_pending"
  | "rejected";

export interface CalendarEvent {
  id: string;
  date: string;
  kind: CalendarEventKind;
  tone: CalendarEventTone;
  status: RequestStatus;
  title: string;
  subtitle: string | null;
  employeeId: string;
  employeeName: string | null;
  sourceRequestId: string;
}

export const CALENDAR_TONE_CLASSES: Record<
  CalendarEventTone,
  { dot: string; label: string; chip: string }
> = {
  leave_approved: {
    dot: "bg-[var(--aster-success)]",
    label: "Congé approuvé",
    chip: "bg-[var(--aster-success-bg)] text-[var(--aster-success)]",
  },
  leave_pending: {
    dot: "bg-[var(--aster-warning)]",
    label: "Congé en attente",
    chip: "bg-[var(--aster-warning-bg)] text-[var(--aster-warning)]",
  },
  telework_approved: {
    dot: "bg-[var(--aster-accent)]",
    label: "Télétravail approuvé",
    chip: "bg-[#e7f2f8] text-[var(--aster-accent)]",
  },
  telework_pending: {
    dot: "bg-[#7c5cbf]",
    label: "Télétravail en attente",
    chip: "bg-[#f1ecf9] text-[#5a3f91]",
  },
  rejected: {
    dot: "bg-[var(--aster-danger)]/55",
    label: "Demande refusée",
    chip: "bg-[var(--aster-danger-bg)] text-[var(--aster-danger)]",
  },
};
