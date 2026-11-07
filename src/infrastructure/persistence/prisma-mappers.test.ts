import { describe, expect, it } from "vitest";
import {
  dateOnlyToUtc,
  mapLeaveRequest,
  mapTeleworkRequest,
  utcToDateOnly,
} from "@/infrastructure/persistence/prisma-mappers";

describe("prisma date mappers", () => {
  it("round-trips date-only values in UTC", () => {
    const raw = "2026-12-21";
    expect(utcToDateOnly(dateOnlyToUtc(raw))).toBe(raw);
  });

  it("rejects malformed dates", () => {
    expect(() => dateOnlyToUtc("21/12/2026")).toThrow(/invalide/i);
  });

  it("maps leave request rows to domain shape", () => {
    const mapped = mapLeaveRequest({
      id: "leave-1",
      employeeId: "emp-lea",
      type: "conges_payes",
      startDate: dateOnlyToUtc("2026-12-21"),
      endDate: dateOnlyToUtc("2026-12-31"),
      halfDayStart: false,
      halfDayEnd: false,
      daysCount: 8,
      status: "en_attente_manager",
      comment: "demo",
      managerComment: null,
      createdAt: new Date("2026-11-02T09:15:00.000Z"),
      updatedAt: new Date("2026-11-02T09:15:00.000Z"),
    });

    expect(mapped.startDate).toBe("2026-12-21");
    expect(mapped.endDate).toBe("2026-12-31");
    expect(mapped.status).toBe("en_attente_manager");
  });

  it("maps telework rejection comment", () => {
    const mapped = mapTeleworkRequest({
      id: "tw-3",
      employeeId: "emp-marc",
      type: "regulier",
      month: "2026-11",
      startDate: dateOnlyToUtc("2026-11-01"),
      endDate: dateOnlyToUtc("2026-11-30"),
      days: ["2026-11-04"],
      status: "refusee",
      reason: "plan",
      managerComment: "Continuité de service",
      createdAt: new Date("2026-10-25T09:00:00.000Z"),
      updatedAt: new Date("2026-10-28T15:00:00.000Z"),
    });

    expect(mapped.status).toBe("refusee");
    expect(mapped.managerComment).toBe("Continuité de service");
    expect(mapped.month).toBe("2026-11");
  });
});
