import type { RequestStatus } from "@/domain/types/hr";

export type CalendarEventKind =
  | "leave"
  | "telework"
  | "holiday"
  | "work_on_holiday";

export type CalendarEventTone =
  | "leave_approved"
  | "leave_pending"
  | "telework_approved"
  | "telework_pending"
  | "rejected"
  | "holiday_confirmed"
  | "holiday_provisional"
  | "work_holiday_pending"
  | "work_holiday_approved"
  | "work_holiday_done";

export interface CalendarEvent {
  id: string;
  date: string;
  kind: CalendarEventKind;
  tone: CalendarEventTone;
  status: RequestStatus | string;
  title: string;
  subtitle: string | null;
  employeeId: string;
  employeeName: string | null;
  sourceRequestId: string;
  /** Action UI : demande de travail sur ce férié. */
  actionableHoliday?: boolean;
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
  holiday_confirmed: {
    dot: "bg-[#c45c26]",
    label: "Jour férié (confirmé)",
    chip: "bg-[#f8ebe3] text-[#8a3d16]",
  },
  holiday_provisional: {
    dot: "bg-[#c45c26]/60",
    label: "Jour férié (provisoire)",
    chip: "bg-[#f8ebe3]/80 text-[#8a3d16]",
  },
  work_holiday_pending: {
    dot: "bg-[#0f6a62]",
    label: "Travail férié (en attente)",
    chip: "bg-[#e6f3f1] text-[#0f6a62]",
  },
  work_holiday_approved: {
    dot: "bg-[#0b4f49]",
    label: "Travail férié approuvé",
    chip: "bg-[#d9eeeb] text-[#0b4f49]",
  },
  work_holiday_done: {
    dot: "bg-[#083f3a]",
    label: "Travail férié confirmé",
    chip: "bg-[#cfe8e4] text-[#083f3a]",
  },
};
