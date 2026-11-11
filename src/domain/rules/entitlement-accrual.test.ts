import { describe, expect, it } from "vitest";
import { buildMonthlyPeriod, previewMonthlyCpAccrual, previewMonthlyRttAccrual } from "@/domain/rules/entitlement-accrual";
import {
  isPolicyAutoPostable,
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
    birthDate: "1990-01-15",
    activitySector: "non_agricole",
    ...partial,
  };
}

const policies = seedEntitlementPolicyVersions();

describe("Morocco entitlement preview wiring", () => {
  it("keeps French policies inactive", () => {
    expect(
      policies.filter((p) => p.jurisdiction === "FR").every((p) => !p.isActive),
    ).toBe(true);
  });

  it("posts MA statutory policy when guide_documented and eligibility met", () => {
    const ma = policies.find((p) => p.policyCode === "MA_ANNUAL_LEAVE_STATUTORY")!;
    expect(isPolicyAutoPostable(ma)).toBe(true);
    const line = previewMonthlyCpAccrual({
      employee: emp({ id: "ok" }),
      period: buildMonthlyPeriod(2026, 11),
      policies,
      publicHolidayDates: [],
    });
    expect(line?.calculationStatus).toBe("calculated");
    expect(line?.quantity).toBeGreaterThan(0);
    expect(line?.explanation).toMatch(/231|238/);
  });

  it("does not use cadre/non-cadre for entitlement", () => {
    const a = previewMonthlyCpAccrual({
      employee: emp({ id: "c", category: "cadre" }),
      period: buildMonthlyPeriod(2026, 11),
      policies,
    });
    const b = previewMonthlyCpAccrual({
      employee: emp({ id: "n", category: "non_cadre" }),
      period: buildMonthlyPeriod(2026, 11),
      policies,
    });
    expect(a?.quantity).toBe(b?.quantity);
  });

  it("does not grant French RTT", () => {
    const line = previewMonthlyRttAccrual({
      employee: emp({ id: "r" }),
      period: buildMonthlyPeriod(2026, 11),
      policies,
      officeCalendar: null,
    });
    expect(line?.quantity).toBe(0);
    expect(line?.calculationStatus).toBe("missing_policy_configuration");
  });

  it("preserves historical French ledger accounts without reactivating FR accrual", () => {
    expect(
      policies.find((p) => p.policyCode === "CP_ACQUISITION_JUN_MAY")?.isActive,
    ).toBe(false);
  });
});
