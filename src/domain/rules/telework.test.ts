import { describe, expect, it } from "vitest";
import { assertWithinWeeklyCap } from "@/domain/rules/telework";
import type { Employee } from "@/domain/types/hr";

const employee: Employee = {
  id: "emp",
  demoIdentityId: "x",
  firstName: "Léa",
  lastName: "Dubois",
  email: "lea@demo.local",
  jobTitle: "",
  departmentId: null,
  peopleManagerId: null,
  managerId: "m",
  region: "Casablanca",
  contractType: "cdi",
  grade: "auditeur_senior",
  hireDate: "2021-01-01",
  isActive: true,
  employmentStatus: "actif",
  departureDate: null,
  departureNote: null,
  teleworkEligible: true,
  phoneInternal: null,
  avatarInitials: "LD",
  teleworkDaysPerWeek: 2,
    standardDailyHours: 7,
    isPartTime: false,
    weeklyContractHours: 44,
    workingTimePercent: 100,
    officeCalendarId: null,
    policyGroup: "standard_ma",
    birthDate: "1990-01-15",
    activitySector: "non_agricole",
};

describe("telework weekly cap", () => {
  it("autorise jusqu'à 2 jours", () => {
    expect(assertWithinWeeklyCap(employee, 2).ok).toBe(true);
  });

  it("refuse au-delà de 2 jours", () => {
    const result = assertWithinWeeklyCap(employee, 3);
    expect(result.ok).toBe(false);
  });
});
