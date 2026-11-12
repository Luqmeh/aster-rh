import { describe, expect, it } from "vitest";
import {
  assertCanManagePeopleManagerCatalog,
  canManagePeopleManagerCatalog,
  matchEmployeeForPeopleManager,
} from "@/domain/rules/people-manager";
import type { Employee } from "@/domain/types/hr";

const sample: Employee = {
  id: "emp-kenza",
  demoIdentityId: "demo-x",
  firstName: "KENZA",
  lastName: "RAFIQ",
  email: "kenza@example.com",
  jobTitle: "Responsable RH",
  departmentId: "dept-rh",
  peopleManagerId: null,
  managerId: null,
  region: "Casablanca",
  contractType: "cdi",
  grade: "manager",
  hireDate: "2020-01-01",
  employmentStatus: "actif",
  departureDate: null,
  departureNote: null,
  isActive: true,
  phoneInternal: null,
  avatarInitials: "KR",
  teleworkEligible: true,
  teleworkDaysPerWeek: 2,
  standardDailyHours: 7,
  isPartTime: false,
  weeklyContractHours: 44,
  workingTimePercent: 100,
  officeCalendarId: null,
  policyGroup: "standard_ma",
  birthDate: null,
  activitySector: "non_agricole",
};

describe("people-manager permissions", () => {
  it("autorise RH et Senior Manager", () => {
    expect(canManagePeopleManagerCatalog("admin_rh")).toBe(true);
    expect(canManagePeopleManagerCatalog("chef_de_projet")).toBe(true);
  });

  it("refuse les collaborateurs", () => {
    expect(canManagePeopleManagerCatalog("collaborateur")).toBe(false);
    expect(() =>
      assertCanManagePeopleManagerCatalog("collaborateur"),
    ).toThrow(/People Manager/);
  });
});

describe("matchEmployeeForPeopleManager", () => {
  it("résout par id, e-mail ou nom", () => {
    expect(matchEmployeeForPeopleManager([sample], "emp-kenza")?.id).toBe(
      "emp-kenza",
    );
    expect(
      matchEmployeeForPeopleManager([sample], "kenza@example.com")?.id,
    ).toBe("emp-kenza");
    expect(
      matchEmployeeForPeopleManager([sample], "KENZA RAFIQ")?.id,
    ).toBe("emp-kenza");
  });

  it("autorise un nom sans compte (retour null = entrée manuelle)", () => {
    expect(
      matchEmployeeForPeopleManager([sample], "Personne Externe"),
    ).toBeNull();
  });
});
