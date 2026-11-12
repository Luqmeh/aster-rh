import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_GRADE_LABELS,
  EMPLOYEE_GRADE_VALUES,
  parseEmployeeGrade,
  parseRegion,
} from "@/domain/types/employee-structure";

describe("parseEmployeeGrade", () => {
  it("accepte les trois grades stockés", () => {
    for (const value of EMPLOYEE_GRADE_VALUES) {
      expect(parseEmployeeGrade(value)).toEqual({ ok: true, value });
    }
  });

  it("accepte les libellés français exacts", () => {
    expect(parseEmployeeGrade("Auditeur junior")).toEqual({
      ok: true,
      value: "auditeur_junior",
    });
    expect(parseEmployeeGrade("Auditeur senior")).toEqual({
      ok: true,
      value: "auditeur_senior",
    });
    expect(parseEmployeeGrade("Manager")).toEqual({
      ok: true,
      value: "manager",
    });
  });

  it("refuse cadre / non-cadre sans mapping silencieux", () => {
    for (const obsolete of ["cadre", "non_cadre", "Cadre", "Non-cadre", "non_applicable"]) {
      const result = parseEmployeeGrade(obsolete);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toMatch(/cadre|Grade/i);
      }
    }
  });

  it("refuse les grades arbitraires", () => {
    expect(parseEmployeeGrade("Partner").ok).toBe(false);
    expect(parseEmployeeGrade("").ok).toBe(false);
  });

  it("expose des libellés stables pour l'UI et Excel", () => {
    expect(EMPLOYEE_GRADE_LABELS.auditeur_junior).toBe("Auditeur junior");
    expect(EMPLOYEE_GRADE_LABELS.auditeur_senior).toBe("Auditeur senior");
    expect(EMPLOYEE_GRADE_LABELS.manager).toBe("Manager");
  });
});

describe("parseRegion", () => {
  it("accepte une saisie libre", () => {
    expect(parseRegion("  Casablanca  ")).toEqual({
      ok: true,
      value: "Casablanca",
    });
    expect(parseRegion("Souss-Massa").ok).toBe(true);
  });

  it("refuse vide ou trop long", () => {
    expect(parseRegion("").ok).toBe(false);
    expect(parseRegion("   ").ok).toBe(false);
    expect(parseRegion("x".repeat(121)).ok).toBe(false);
  });

  it("n'impose pas de liste prédéfinie", () => {
    expect(parseRegion("Région inventée pour démo").ok).toBe(true);
  });
});
