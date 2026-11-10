import { describe, expect, it } from "vitest";
import {
  applyCpEndOfPeriodRounding,
  assertCarryoverWithinPolicy,
  buildMonthlyPeriod,
  computeCadreRttEntitlement,
  isFullMonthEmployed,
  isRttEligible,
  previewMonthlyCpAccrual,
  previewMonthlyRttAccrual,
  rttUsageTargetDays,
} from "@/domain/rules/entitlement-accrual";
import {
  CP_MONTHLY_ACCRUAL_DAYS,
  seedEntitlementPolicyVersions,
} from "@/domain/rules/entitlement-policies";
import type { Employee } from "@/domain/types/hr";
import type { OfficeWorkCalendar } from "@/domain/types/entitlement";

function emp(partial: Partial<Employee> & Pick<Employee, "id">): Employee {
  return {
    demoIdentityId: "d",
    firstName: "A",
    lastName: "B",
    email: `${partial.id}@example.test`,
    jobTitle: "Consultant",
    departmentId: "dep",
    managerId: null,
    site: "casablanca",
    contractType: "cdi",
    category: "non_cadre",
    hireDate: "2024-01-01",
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
    weeklyContractHours: 39,
    workingTimePercent: 100,
    officeCalendarId: null,
    ...partial,
  };
}

const policies = seedEntitlementPolicyVersions();

describe("CP accrual", () => {
  it("credits 2.08 for a full month CDI", () => {
    const period = buildMonthlyPeriod(2026, 11);
    const line = previewMonthlyCpAccrual({
      employee: emp({ id: "e1" }),
      period,
      policies,
    });
    expect(line?.quantity).toBe(CP_MONTHLY_ACCRUAL_DAYS);
    expect(line?.account).toBe("conges_payes_en_acquisition");
    expect(line?.calculationStatus).toBe("calculated");
  });

  it("allows CDD and alternant CP eligibility", () => {
    const period = buildMonthlyPeriod(2026, 11);
    for (const contractType of ["cdd", "alternance"] as const) {
      const line = previewMonthlyCpAccrual({
        employee: emp({ id: contractType, contractType }),
        period,
        policies,
      });
      expect(line?.calculationStatus).toBe("calculated");
      expect(line?.quantity).toBe(2.08);
    }
  });

  it("flags partial employment month for HR validation", () => {
    const period = buildMonthlyPeriod(2026, 11);
    const line = previewMonthlyCpAccrual({
      employee: emp({ id: "joiner", hireDate: "2026-11-15" }),
      period,
      policies,
    });
    expect(line?.quantity).toBe(0);
    expect(line?.calculationStatus).toBe("requires_hr_validation");
  });

  it("returns zero outside employment without inventing prorata", () => {
    const period = buildMonthlyPeriod(2026, 3);
    const line = previewMonthlyCpAccrual({
      employee: emp({
        id: "left",
        hireDate: "2020-01-01",
        departureDate: "2025-12-31",
        employmentStatus: "parti",
      }),
      period,
      policies,
    });
    expect(line?.quantity).toBe(0);
    expect(line?.calculationStatus).toBe("calculated");
  });

  it("flags part-time for HR validation and does not auto-credit", () => {
    const period = buildMonthlyPeriod(2026, 11);
    const line = previewMonthlyCpAccrual({
      employee: emp({ id: "pt", isPartTime: true, workingTimePercent: 80 }),
      period,
      policies,
    });
    expect(line?.calculationStatus).toBe("requires_hr_validation");
    expect(line?.quantity).toBe(0);
  });

  it("keeps end-of-period rounding opt-in (10.4 → 11 only when configured)", () => {
    expect(applyCpEndOfPeriodRounding(10.4, "none")).toBe(10.4);
    expect(
      applyCpEndOfPeriodRounding(10.4, "end_of_period_example_ceil_half"),
    ).toBe(11);
  });
});

describe("RTT accrual", () => {
  it("excludes alternants", () => {
    expect(isRttEligible(emp({ id: "alt", contractType: "alternance" }))).toBe(
      false,
    );
    const period = buildMonthlyPeriod(2026, 11);
    const line = previewMonthlyRttAccrual({
      employee: emp({ id: "alt", contractType: "alternance" }),
      period,
      policies,
      officeCalendar: null,
    });
    expect(line?.calculationStatus).toBe("ineligible");
    expect(line?.quantity).toBe(0);
  });

  it("credits non-cadre monthly slice of 11", () => {
    const period = buildMonthlyPeriod(2026, 11);
    const line = previewMonthlyRttAccrual({
      employee: emp({ id: "nc" }),
      period,
      policies,
      officeCalendar: null,
    });
    expect(line?.calculationStatus).toBe("calculated");
    expect(line?.quantity).toBeCloseTo(11 / 12, 4);
  });

  it("requires validated office calendar for cadres", () => {
    const period = buildMonthlyPeriod(2026, 11);
    const missing = previewMonthlyRttAccrual({
      employee: emp({ id: "cad", category: "cadre" }),
      period,
      policies,
      officeCalendar: null,
    });
    expect(missing?.calculationStatus).toBe("missing_policy_configuration");

    const cal: OfficeWorkCalendar = {
      id: "c1",
      code: "CASA",
      label: "Casablanca",
      siteKey: "casablanca",
      workingHolidays: ["2026-01-01", "2026-05-01"],
      validationStatus: "hr_configured",
      notes: null,
    };
    const ok = computeCadreRttEntitlement(cal);
    expect(ok.days).toBe(9);
    expect(ok.status).toBe("calculated");

    const line = previewMonthlyRttAccrual({
      employee: emp({ id: "cad2", category: "cadre", officeCalendarId: "c1" }),
      period,
      policies,
      officeCalendar: cal,
    });
    expect(line?.quantity).toBeCloseTo(9 / 12, 4);
  });

  it("models usage targets without granting credits", () => {
    expect(rttUsageTargetDays(11, 70)).toBeCloseTo(7.7, 4);
    expect(rttUsageTargetDays(11, 100)).toBe(11);
  });
});

describe("carryover / employment helpers", () => {
  it("limits CP carryover to 5 days without silent exception", () => {
    expect(
      assertCarryoverWithinPolicy({
        requestedDays: 5,
        maxDays: 5,
        hasPartnerApproval: false,
        hasLeavePlanThroughDec31: false,
      }).ok,
    ).toBe(true);
    const blocked = assertCarryoverWithinPolicy({
      requestedDays: 8,
      maxDays: 5,
      hasPartnerApproval: false,
      hasLeavePlanThroughDec31: false,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.requiresException).toBe(true);
  });

  it("allows exceptional carryover only with partner + plan", () => {
    const ok = assertCarryoverWithinPolicy({
      requestedDays: 8,
      maxDays: 5,
      hasPartnerApproval: true,
      hasLeavePlanThroughDec31: true,
    });
    expect(ok.ok).toBe(true);
    expect(ok.requiresException).toBe(true);
  });

  it("detects full-month employment boundaries", () => {
    const period = buildMonthlyPeriod(2026, 6);
    expect(
      isFullMonthEmployed(emp({ id: "x", hireDate: "2026-06-01" }), period),
    ).toBe(true);
    expect(
      isFullMonthEmployed(emp({ id: "y", hireDate: "2026-06-02" }), period),
    ).toBe(false);
  });
});
