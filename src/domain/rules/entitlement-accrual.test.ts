import { describe, expect, it } from "vitest";
import {
  assertCarryoverWithinPolicy,
  buildMonthlyPeriod,
  previewMonthlyCpAccrual,
  previewMonthlyRttAccrual,
} from "@/domain/rules/entitlement-accrual";
import {
  isPolicyAutoPostable,
  MA_ANNUAL_LEAVE_DAYS_PER_MONTH_PROPOSED,
  seedEntitlementPolicyVersions,
} from "@/domain/rules/entitlement-policies";
import type { Employee } from "@/domain/types/hr";

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
    weeklyContractHours: 44,
    workingTimePercent: 100,
    officeCalendarId: null,
    policyGroup: "standard_ma",
    ...partial,
  };
}

const policies = seedEntitlementPolicyVersions();

describe("Morocco entitlement engine", () => {
  it("does not auto-apply deactivated French CP 2.08 policy", () => {
    const fr = policies.find((p) => p.policyCode === "CP_ACQUISITION_JUN_MAY");
    expect(fr?.isActive).toBe(false);
    expect(fr?.jurisdiction).toBe("FR");
  });

  it("does not auto-post Moroccan annual leave until hr_configured", () => {
    const ma = policies.find((p) => p.policyCode === "MA_ANNUAL_LEAVE_STATUTORY");
    expect(ma).toBeTruthy();
    expect(isPolicyAutoPostable(ma!)).toBe(false);

    const period = buildMonthlyPeriod(2026, 11);
    const line = previewMonthlyCpAccrual({
      employee: emp({ id: "e1" }),
      period,
      policies,
    });
    expect(line?.quantity).toBe(0);
    expect(line?.calculationStatus).toBe("requires_hr_validation");
    expect(line?.explanation).toMatch(/valider|RH/i);
    expect(ma!.rules.monthlyAccrualDays).toBe(
      MA_ANNUAL_LEAVE_DAYS_PER_MONTH_PROPOSED,
    );
  });

  it("does not use cadre/non-cadre for entitlement", () => {
    const period = buildMonthlyPeriod(2026, 11);
    const cadre = previewMonthlyCpAccrual({
      employee: emp({ id: "c", category: "cadre" }),
      period,
      policies,
    });
    const non = previewMonthlyCpAccrual({
      employee: emp({ id: "n", category: "non_cadre" }),
      period,
      policies,
    });
    expect(cadre?.quantity).toBe(0);
    expect(non?.quantity).toBe(0);
    expect(cadre?.calculationStatus).toBe(non?.calculationStatus);
  });

  it("does not grant French RTT automatically", () => {
    const period = buildMonthlyPeriod(2026, 11);
    const line = previewMonthlyRttAccrual({
      employee: emp({ id: "r" }),
      period,
      policies,
      officeCalendar: null,
    });
    expect(line?.quantity).toBe(0);
    expect(line?.calculationStatus).toBe("missing_policy_configuration");
    expect(policies.filter((p) => p.kind === "rtt").every((p) => !p.isActive)).toBe(
      true,
    );
  });

  it("flags part-time without inventing a formula", () => {
    const period = buildMonthlyPeriod(2026, 11);
    const line = previewMonthlyCpAccrual({
      employee: emp({ id: "pt", isPartTime: true }),
      period,
      policies,
    });
    expect(line?.quantity).toBe(0);
    expect(line?.calculationStatus).toBe("requires_hr_validation");
  });

  it("keeps carryover exceptions non-automatic", () => {
    const blocked = assertCarryoverWithinPolicy({
      requestedDays: 8,
      maxDays: 5,
      hasPartnerApproval: false,
      hasLeavePlanThroughDec31: false,
    });
    expect(blocked.ok).toBe(false);
  });
});
