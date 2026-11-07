import { describe, expect, it } from "vitest";
import { buildCalendarEvents } from "@/domain/rules/calendar-events";
import { CALENDAR_TONE_CLASSES } from "@/domain/types/calendar";
import type { LeaveRequest, TeleworkRequest } from "@/domain/types/hr";
import { addMonths, formatMonthYearFr } from "@/domain/rules/dates";

const leavePending: LeaveRequest = {
  id: "leave-p",
  employeeId: "emp-lea",
  type: "rtt",
  startDate: "2026-11-10",
  endDate: "2026-11-10",
  halfDayStart: false,
  halfDayEnd: false,
  daysCount: 1,
  status: "en_attente_manager",
  comment: null,
  managerComment: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const leaveApproved: LeaveRequest = {
  ...leavePending,
  id: "leave-a",
  startDate: "2026-11-12",
  endDate: "2026-11-13",
  status: "approuvee",
};

const twApproved: TeleworkRequest = {
  id: "tw-a",
  employeeId: "emp-lea",
  type: "regulier",
  month: "2026-11",
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  days: ["2026-11-03", "2026-11-05"],
  status: "approuvee",
  reason: null,
  managerComment: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const twPending: TeleworkRequest = {
  ...twApproved,
  id: "tw-p",
  days: ["2026-11-17"],
  status: "en_attente_manager",
};

const twRejected: TeleworkRequest = {
  ...twApproved,
  id: "tw-r",
  days: ["2026-11-24"],
  status: "refusee",
};

describe("buildCalendarEvents", () => {
  it("génère les événements avec les bons tons", () => {
    const events = buildCalendarEvents({
      month: "2026-11",
      leaves: [leavePending, leaveApproved],
      telework: [twApproved, twPending, twRejected],
    });

    expect(events.some((e) => e.tone === "leave_pending")).toBe(true);
    expect(events.some((e) => e.tone === "leave_approved")).toBe(true);
    expect(events.some((e) => e.tone === "telework_approved")).toBe(true);
    expect(events.some((e) => e.tone === "telework_pending")).toBe(true);
    expect(events.some((e) => e.tone === "rejected")).toBe(true);
    expect(
      events
        .filter((e) => e.tone === "rejected")
        .every((e) => e.title.includes("non confirmé") || e.title.includes("refusé")),
    ).toBe(true);
    expect(
      events
        .filter((e) => e.tone === "telework_pending" || e.tone === "leave_pending")
        .every((e) => e.title.includes("en attente")),
    ).toBe(true);
  });

  it("ne crée pas de doublons de source — un événement par jour/demande", () => {
    const events = buildCalendarEvents({
      month: "2026-11",
      leaves: [leaveApproved],
      telework: [],
    });
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(events).toHaveLength(2);
  });

  it("expose des classes de couleur pour chaque ton", () => {
    for (const tone of Object.keys(CALENDAR_TONE_CLASSES)) {
      expect(CALENDAR_TONE_CLASSES[tone as keyof typeof CALENDAR_TONE_CLASSES].dot).toBeTruthy();
    }
  });
});

describe("french month formatting", () => {
  it("formate et navigue les mois en fr-FR", () => {
    expect(formatMonthYearFr("2026-11").toLowerCase()).toMatch(/nov/);
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-11", -1)).toBe("2026-10");
  });
});
