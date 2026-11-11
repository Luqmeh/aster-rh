import { describe, expect, it } from "vitest";
import type { Employee } from "@/domain/types/hr";
import {
  annualEntitlementDays,
  assertMaCarryoverAgreement,
  completeYearsOfService,
  computeMoroccoAnnualLeaveAccrual,
  continuousServiceMonths,
  countEffectiveWorkingDays,
  MA_ADULT_DAYS_PER_SERVICE_MONTH,
  MA_CONTINUOUS_SERVICE_MONTHS_BEFORE_ENTITLEMENT,
  MA_EFFECTIVE_DAYS_PER_SERVICE_MONTH,
  MA_HOURS_PER_SERVICE_MONTH_NON_AGRI,
  MA_MAX_ANNUAL_LEAVE_DAYS,
  MA_MINOR_DAYS_PER_SERVICE_MONTH,
  MA_SENIORITY_DAYS_PER_FIVE_YEARS,
} from "@/domain/rules/morocco-annual-leave";

function emp(partial: Partial<Employee> & Pick<Employee, "id">): Employee {
  return {
    demoIdentityId: "d",
    firstName: "A",
    lastName: "B",
    email: `${partial.id}@example.test`,
    jobTitle: "Consultant",
    departmentId: "dep",
    managerId: null,
    site: "Casablanca (démo)",
    contractType: "cdi",
    category: "non_applicable",
    hireDate: "2020-01-01",
    employmentStatus: "actif",
    departureDate: null,
    departureNote: null,
    isActive: true,
    phoneInternal: null,
    avatarInitials: "AB",
    teleworkEligible: true,
    teleworkDaysPerWeek: 2,
    standardDailyHours: 7,
    isPartTime: false,
    weeklyContractHours: 44,
    workingTimePercent: 100,
    officeCalendarId: null,
    policyGroup: "standard_ma",
    birthDate: "1990-06-01",
    activitySector: "non_agricole",
    ...partial,
  };
}

describe("Loi 65-99 art. 231–238 annual leave", () => {
  it("art. 231 adult rate 1.5 and minor rate 2 (statutory mode)", () => {
    expect(MA_ADULT_DAYS_PER_SERVICE_MONTH).toBe(1.5);
    expect(MA_MINOR_DAYS_PER_SERVICE_MONTH).toBe(2);
    const adult = computeMoroccoAnnualLeaveAccrual({
      employee: emp({ id: "a", birthDate: "1990-01-01" }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
      rateMode: "statutory",
    });
    expect(adult.ratePerServiceMonth).toBe(1.5);
    expect(adult.isMinor).toBe(false);

    const minor = computeMoroccoAnnualLeaveAccrual({
      employee: emp({ id: "m", birthDate: "2010-01-01", hireDate: "2025-01-01" }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
      rateMode: "statutory",
    });
    expect(minor.isMinor).toBe(true);
    expect(minor.ratePerServiceMonth).toBe(2);
  });

  it("art. 231 six-month continuous service gate", () => {
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({ id: "j", hireDate: "2026-08-01" }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
    });
    expect(calc.continuousServiceMonthsAtAsOf).toBeLessThan(
      MA_CONTINUOUS_SERVICE_MONTHS_BEFORE_ENTITLEMENT,
    );
    expect(calc.sixMonthEligibilityMet).toBe(false);
    expect(calc.calculationStatus).toBe("requires_hr_validation");
    expect(calc.periodCreditDays).toBeGreaterThan(0);
  });

  it("art. 232 seniority +1.5 per 5 years capped at 30", () => {
    expect(
      annualEntitlementDays({
        ratePerServiceMonth: 1.5,
        completeFiveYearPeriods: 0,
      }),
    ).toBe(18);
    expect(
      annualEntitlementDays({
        ratePerServiceMonth: 1.5,
        completeFiveYearPeriods: 2,
      }),
    ).toBe(18 + 2 * MA_SENIORITY_DAYS_PER_FIVE_YEARS);
    expect(
      annualEntitlementDays({
        ratePerServiceMonth: 1.5,
        completeFiveYearPeriods: 20,
      }),
    ).toBe(MA_MAX_ANNUAL_LEAVE_DAYS);

    const years = completeYearsOfService("2010-01-01", "2026-11-30", null);
    expect(years).toBeGreaterThanOrEqual(16);
    const periods = Math.floor(years / 5);
    expect(periods).toBeGreaterThanOrEqual(3);
  });

  it("company mode uses 2 j/mois total (not 1.5+2) and keeps statutory visible", () => {
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({ id: "ft", hireDate: "2020-01-01", weeklyContractHours: 44 }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
      rateMode: "company",
    });
    expect(calc.statutoryRatePerServiceMonth).toBe(1.5);
    expect(calc.companyRatePerServiceMonth).toBe(2);
    expect(calc.ratePerServiceMonth).toBe(2);
    expect(calc.serviceMonthBasis).toBe("full_time_hours_equivalence_art238_2");
    expect(calc.serviceMonthsInPeriod).toBe(1);
    expect(calc.sixMonthEligibilityMet).toBe(true);
    expect(calc.calculationStatus).toBe("calculated");
    expect(calc.periodCreditDays).toBeCloseTo(calc.annualEntitlementDays / 12, 4);
    expect(calc.annualEntitlementDays).toBeGreaterThanOrEqual(24);
    expect(calc.statutoryAnnualEntitlementDays).toBeLessThan(
      calc.annualEntitlementDays,
    );
  });

  it("statutory mode keeps adult 1.5 j/mois", () => {
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({ id: "st", hireDate: "2020-01-01", weeklyContractHours: 44 }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
      rateMode: "statutory",
    });
    expect(calc.ratePerServiceMonth).toBe(1.5);
    expect((44 * 52) / 12).toBeCloseTo(MA_HOURS_PER_SERVICE_MONTH_NON_AGRI, 0);
  });

  it("art. 238-1 converts effective working days / 26", () => {
    expect(MA_EFFECTIVE_DAYS_PER_SERVICE_MONTH).toBe(26);
    const days = countEffectiveWorkingDays("2026-11-01", "2026-11-30", []);
    expect(days).toBeGreaterThan(0);
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({
        id: "partial",
        hireDate: "2026-11-10",
        weeklyContractHours: 44,
      }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: ["2026-11-18"],
    });
    expect(calc.serviceMonthBasis).toBe("effective_days_art238_1");
    expect(calc.sixMonthEligibilityMet).toBe(false);
  });

  it("art. 238-2 hours path for part-time", () => {
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({
        id: "pt",
        isPartTime: true,
        weeklyContractHours: 22,
        hireDate: "2020-01-01",
      }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
      hoursWorkedInPeriod: 95.5,
    });
    expect(calc.serviceMonthBasis).toBe("hours_worked_art238_2");
    expect(calc.serviceMonthsInPeriod).toBeCloseTo(0.5, 4);
    expect(calc.calculationStatus).toBe("calculated");
  });

  it("rejects part-time without hours", () => {
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({
        id: "pt2",
        isPartTime: true,
        weeklyContractHours: 22,
        hireDate: "2020-01-01",
      }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
    });
    expect(calc.calculationStatus).toBe("requires_hr_validation");
    expect(calc.serviceMonthBasis).toBe("unavailable");
  });

  it("art. 240 carryover requires mutual agreement — no French 5-day rule", () => {
    expect(
      assertMaCarryoverAgreement({
        hasMutualAgreement: false,
        spansAtMostTwoConsecutiveYears: true,
      }).ok,
    ).toBe(false);
    expect(
      assertMaCarryoverAgreement({
        hasMutualAgreement: true,
        spansAtMostTwoConsecutiveYears: true,
      }).ok,
    ).toBe(true);
  });

  it("continuousServiceMonths respects hire/departure", () => {
    expect(continuousServiceMonths("2026-01-15", "2026-07-14", null)).toBe(5);
    expect(continuousServiceMonths("2026-01-15", "2026-07-15", null)).toBe(6);
  });

  it("art. 233 CDD remains eligible for accrual with process warning", () => {
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({
        id: "cdd",
        contractType: "cdd",
        hireDate: "2020-01-01",
      }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
    });
    expect(calc.calculationStatus).toBe("calculated");
    expect(calc.warnings.some((w) => w.includes("233"))).toBe(true);
    expect(calc.legalReferences).toContain("Loi 65-99 art. 233");
  });

  it("art. 238-2 agricultural hour threshold 208", () => {
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({
        id: "agri",
        activitySector: "agricole",
        hireDate: "2020-01-01",
        weeklyContractHours: 44,
      }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
      hoursWorkedInPeriod: 208,
    });
    expect(calc.serviceMonthBasis).toBe("hours_worked_art238_2");
    expect(calc.serviceMonthsInPeriod).toBe(1);
  });

  it("does not invent art. 239 assimilation — hours path only when supplied", () => {
    // Art. 239 périodes assimilées : pas d'auto-mapping WorkAbsence dans le moteur.
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({ id: "assim", hireDate: "2020-01-01" }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
    });
    expect(calc.legalReferences).not.toContain("Loi 65-99 art. 239");
    expect(calc.serviceMonthBasis).toBe("full_time_hours_equivalence_art238_2");
  });

  it("joiner partial month uses effective days / 26", () => {
    const calc = computeMoroccoAnnualLeaveAccrual({
      employee: emp({
        id: "join",
        hireDate: "2026-11-16",
        weeklyContractHours: 44,
      }),
      asOfDate: "2026-11-30",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      publicHolidayDates: [],
    });
    expect(calc.serviceMonthBasis).toBe("effective_days_art238_1");
    expect(calc.serviceMonthsInPeriod).toBeLessThan(1);
    expect(calc.sixMonthEligibilityMet).toBe(false);
  });
});
