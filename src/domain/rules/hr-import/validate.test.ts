import { describe, expect, it } from "vitest";
import {
  buildPreviewSummary,
  parseDecimalFr,
  parseIsoDate,
  validateBalanceRows,
  validateEmployeeRows,
} from "@/domain/rules/hr-import/validate";
import type { Employee, OrganizationUnit } from "@/domain/types/hr";

const departments: OrganizationUnit[] = [
  { id: "dep-audit", name: "Audit & Assurance", code: "AUDIT", parentId: null },
];

function emp(id: string, email: string): Employee {
  return {
    id,
    demoIdentityId: `demo-${id}`,
    firstName: "A",
    lastName: "B",
    email,
    jobTitle: "Consultant",
    departmentId: "dep-audit",
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
    birthDate: null,
    activitySector: "non_agricole",
  };
}

describe("hr-import validation", () => {
  it("parses FR dates and decimals", () => {
    expect(parseIsoDate("15/01/2021")).toBe("2021-01-15");
    expect(parseDecimalFr("12,5")).toBe(12.5);
  });

  it("accepts a valid employee row", () => {
    const drafts = validateEmployeeRows({
      rows: [
        {
          rowNumber: 2,
          cells: {
            matricule: "emp-new",
            firstName: "Sara",
            lastName: "Benali",
            email: "sara.benali@demo.aster-rh.local",
            department: "AUDIT",
            jobTitle: "Consultante",
            site: "Casablanca (démo)",
            hireDate: "2024-03-01",
            contractType: "cdi",
            employmentStatus: "actif",
          },
        },
      ],
      mapping: {},
      departmentMapping: {},
      departments,
      existingEmployees: [],
      updateExisting: false,
    });
    expect(drafts[0]?.severity).toBe("ok");
    expect(drafts[0]?.action).toBe("create");
  });

  it("rejects duplicate matricules and emails", () => {
    const drafts = validateEmployeeRows({
      rows: [
        {
          rowNumber: 2,
          cells: {
            matricule: "emp-a",
            firstName: "A",
            lastName: "A",
            email: "a@demo.aster-rh.local",
            department: "AUDIT",
            jobTitle: "X",
            site: "Casablanca",
            hireDate: "2024-01-01",
            contractType: "cdi",
            employmentStatus: "actif",
          },
        },
        {
          rowNumber: 3,
          cells: {
            matricule: "emp-a",
            firstName: "B",
            lastName: "B",
            email: "b@demo.aster-rh.local",
            department: "AUDIT",
            jobTitle: "X",
            site: "Casablanca",
            hireDate: "2024-01-01",
            contractType: "cdi",
            employmentStatus: "actif",
          },
        },
      ],
      mapping: {},
      departmentMapping: {},
      departments,
      existingEmployees: [],
      updateExisting: false,
    });
    expect(drafts[1]?.severity).toBe("error");
  });

  it("rejects unknown balance matricule and negatives", () => {
    const balances = validateBalanceRows({
      rows: [
        {
          rowNumber: 2,
          cells: {
            matricule: "missing",
            cpDays: "-1",
            effectiveDate: "2026-01-01",
            sourceReference: "Excel RH",
            verificationStatus: "verifie",
          },
        },
      ],
      mapping: {},
      employeeDrafts: [],
      existingEmployees: [emp("emp-lea", "lea@demo.aster-rh.local")],
    });
    expect(balances[0]?.severity).toBe("error");
  });

  it("accepts valid opening balances", () => {
    const balances = validateBalanceRows({
      rows: [
        {
          rowNumber: 2,
          cells: {
            matricule: "emp-lea",
            cpDays: "10",
            rttDays: "2",
            recoveryHours: "7",
            effectiveDate: "2026-01-01",
            sourceReference: "Inventaire RH",
            verificationStatus: "verifie",
          },
        },
      ],
      mapping: {},
      employeeDrafts: [],
      existingEmployees: [emp("emp-lea", "lea@demo.aster-rh.local")],
    });
    expect(balances[0]?.severity).toBe("ok");
    expect(balances[0]?.recoveryDays).toBe(1);
    const summary = buildPreviewSummary([], balances);
    expect(summary.openingCpTotal).toBe(10);
    expect(summary.openingRecoveryDaysTotal).toBe(1);
  });
});
