import { describe, expect, it } from "vitest";
import {
  assertTeleworkEligibility,
  MAX_TELEWORK_DAYS_PER_MONTH,
  validateMonthlyTeleworkPlan,
} from "@/domain/rules/telework-monthly";
import { listWeekdaysInMonth } from "@/domain/rules/dates";
import type { Employee, LeaveRequest } from "@/domain/types/hr";

const eligible: Employee = {
  id: "e1",
  demoIdentityId: "x",
  firstName: "A",
  lastName: "B",
  email: "a@demo.local",
  jobTitle: "Consultante",
  departmentId: "d",
  managerId: "m",
  site: "Lyon",
  contractType: "cdi",
  category: "cadre",
  hireDate: "2021-01-01",
  isActive: true,
  employmentStatus: "actif",
  departureDate: null,
  departureNote: null,
  teleworkEligible: true,
  phoneInternal: null,
  avatarInitials: "AB",
  teleworkDaysPerWeek: 2,
    standardDailyHours: 7,
    isPartTime: false,
    weeklyContractHours: 39,
    workingTimePercent: 100,
    officeCalendarId: null,
};

describe("validateMonthlyTeleworkPlan", () => {
  it("accepte un plan valide ≤ 2 j/semaine et ≤ 12 j/mois", () => {
    const days = [
      "2026-12-01",
      "2026-12-03",
      "2026-12-08",
      "2026-12-10",
    ];
    const result = validateMonthlyTeleworkPlan("2026-12", days);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days).toHaveLength(4);
  });

  it("refuse plus de 2 jours dans la même semaine ISO", () => {
    const result = validateMonthlyTeleworkPlan("2026-12", [
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/semaine/i);
  });

  it("refuse plus de 12 jours dans le mois", () => {
    const picked = listWeekdaysInMonth("2026-12").slice(
      0,
      MAX_TELEWORK_DAYS_PER_MONTH + 1,
    );
    expect(picked.length).toBe(MAX_TELEWORK_DAYS_PER_MONTH + 1);
    const result = validateMonthlyTeleworkPlan("2026-12", picked);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/12/);
  });

  it("refuse les week-ends", () => {
    const result = validateMonthlyTeleworkPlan("2026-12", ["2026-12-05"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/week-end/i);
  });

  it("refuse les dates hors mois", () => {
    const result = validateMonthlyTeleworkPlan("2026-12", ["2026-11-30"]);
    expect(result.ok).toBe(false);
  });

  it("refuse les doublons", () => {
    const result = validateMonthlyTeleworkPlan("2026-12", [
      "2026-12-01",
      "2026-12-01",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/double/i);
  });

  it("refuse les conflits avec congés approuvés", () => {
    const leave: LeaveRequest = {
      id: "l1",
      employeeId: "e1",
      type: "conges_payes",
      startDate: "2026-12-01",
      endDate: "2026-12-02",
      halfDayStart: false,
      halfDayEnd: false,
      daysCount: 2,
      status: "approuvee",
      comment: null,
      managerComment: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const result = validateMonthlyTeleworkPlan(
      "2026-12",
      ["2026-12-01", "2026-12-08"],
      [leave],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Conflit/i);
  });

  it("gère les semaines à cheval entre mois (jours du mois uniquement)", () => {
    // 2026-11-30 is Monday in Nov; Dec week starting Nov 30 includes Dec 1-4
    const result = validateMonthlyTeleworkPlan("2026-12", [
      "2026-12-01",
      "2026-12-02",
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("eligibility", () => {
  it("autorise un profil éligible", () => {
    expect(assertTeleworkEligibility(eligible).ok).toBe(true);
  });

  it("refuse un profil non éligible avec message clair", () => {
    const result = assertTeleworkEligibility({
      ...eligible,
      teleworkEligible: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/éligible/i);
  });
});
