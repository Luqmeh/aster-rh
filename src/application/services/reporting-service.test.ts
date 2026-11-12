import { beforeEach, describe, expect, it } from "vitest";
import {
  createReportingService,
  parseReportingFilters,
} from "@/application/services/reporting-service";
import { AuthError } from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import { mockEmail } from "@/infrastructure/email/mock-email";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import type { Employee } from "@/domain/types/hr";
import { APPROVED_LEAVE_STATUS } from "@/domain/rules/reporting";
import { buildWorkbook } from "@/infrastructure/reporting/excel-exports";
import ExcelJS from "exceljs";

function sessionFor(
  employee: Employee,
  role: AuthSession["role"],
): AuthSession {
  return {
    userId: `acc-${employee.id}`,
    email: employee.email,
    employee,
    role,
    authProvider: "credentials",
    mustChangePassword: false,
    isDemoMode: true,
  };
}

function container() {
  return {
    hr: demoHrRepository,
    email: mockEmail,
    auth: { getSession: async () => null, signOut: async () => undefined },
    storage: {} as never,
    payroll: {} as never,
    persistence: "memory" as const,
  };
}

describe("reporting-service", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  async function emp(id: string) {
    const e = await demoHrRepository.getEmployee(id);
    if (!e) throw new Error("missing");
    return e;
  }

  it("refuse le reporting au collaborateur", async () => {
    const lea = await emp("emp-lea");
    const service = createReportingService(container());
    await expect(
      service.getDashboard(sessionFor(lea, "collaborateur"), {
        preset: "cette_annee",
      }),
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      service.exportReport(sessionFor(lea, "collaborateur"), "annuaire", {
        preset: "cette_annee",
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("autorise RH et Chef de projet", async () => {
    const camille = await emp("emp-camille");
    const julien = await emp("emp-julien");
    const service = createReportingService(container());
    const hrDash = await service.getDashboard(
      sessionFor(camille, "admin_rh"),
      { preset: "cette_annee" },
    );
    const chefDash = await service.getDashboard(
      sessionFor(julien, "chef_de_projet"),
      { preset: "cette_annee" },
    );
    expect(hrDash.kpis.effectifActif).toBeGreaterThan(0);
    expect(chefDash.kpis.effectifActif).toBe(hrDash.kpis.effectifActif);
  });

  it("ne compte pas les refus comme absences approuvées", async () => {
    const camille = await emp("emp-camille");
    const service = createReportingService(container());
    const leaves = await demoHrRepository.listLeaveRequests();
    const refused = leaves.filter((l) => l.status === "refusee");
    const approved = leaves.filter((l) => l.status === APPROVED_LEAVE_STATUS);

    const dash = await service.getDashboard(sessionFor(camille, "admin_rh"), {
      preset: "personnalise",
      startDate: "2025-01-01",
      endDate: "2026-12-31",
    });

    const approvedDays = approved
      .filter((r) => r.startDate <= "2026-12-31" && r.endDate >= "2025-01-01")
      .reduce((s, r) => s + r.daysCount, 0);

    expect(dash.kpis.absencesApprouveesJours).toBe(approvedDays);
    expect(dash.kpis.demandesCongesApprouvees).toBe(
      approved.filter(
        (r) => r.startDate <= "2026-12-31" && r.endDate >= "2025-01-01",
      ).length,
    );
    // refusés ne gonflent pas les jours d'absence
    if (refused.length > 0) {
      expect(dash.kpis.absencesApprouveesJours).toBeLessThan(
        approvedDays + refused.reduce((s, r) => s + r.daysCount, 0),
      );
    }
  });

  it("agrège l'effectif actif par région sans double comptage", async () => {
    const camille = await emp("emp-camille");
    const service = createReportingService(container());
    const all = await service.getDashboard(sessionFor(camille, "admin_rh"), {
      preset: "cette_annee",
    });
    expect(all.employees.every((e) => e.departmentId == null)).toBe(true);
    const sumRegions = all.charts.workforceByDepartment.reduce(
      (s, b) => s + b.value,
      0,
    );
    expect(sumRegions).toBe(all.kpis.effectifActif);
  });

  it("sépare récupération compensatrice et RTT dans l'export soldes", async () => {
    const camille = await emp("emp-camille");
    const filters = parseReportingFilters({ preset: "cette_annee" });
    const { buffer, rowCount } = await buildWorkbook(
      container(),
      "soldes",
      filters,
    );
    expect(rowCount).toBeGreaterThan(0);
    const wb = new ExcelJS.Workbook();
    // ExcelJS Buffer typings diverge from Node Buffer under TS 5.x
    await wb.xlsx.load(Uint8Array.from(buffer) as never);
    const sheet = wb.worksheets[0];
    const headers = (sheet.getRow(1).values as string[]).filter(Boolean);
    expect(headers).toContain("RTT annuels acquis");
    expect(headers).toContain("Récupération compensatrice acquise (jours)");
    expect(headers).not.toContain("password");
    expect(headers.join(" ")).not.toMatch(/cv|storageKey|hrNotes|url/i);

    // autorisation export
    const service = createReportingService(container());
    const exported = await service.exportReport(
      sessionFor(camille, "admin_rh"),
      "soldes",
      { preset: "cette_annee" },
    );
    expect(exported.filename).toMatch(/ASTER_soldes_/);
    expect(exported.base64.length).toBeGreaterThan(100);
  });

  it("exclut les champs sensibles des exports recrutement et documents", async () => {
    const filters = parseReportingFilters({
      preset: "personnalise",
      startDate: "2025-01-01",
      endDate: "2026-12-31",
    });
    for (const key of ["recrutement", "documents", "annuaire", "lifecycle"] as const) {
      const { buffer } = await buildWorkbook(container(), key, filters);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(Uint8Array.from(buffer) as never);
      const headers = (
        wb.worksheets[0].getRow(1).values as string[]
      ).filter(Boolean);
      const joined = headers.join("|").toLowerCase();
      expect(joined).not.toMatch(/password|hash|cv|storage|url sign|note interne|hrnotes/);
    }
  });

  it("aligne dashboard et export planning sur les absences approuvées", async () => {
    const camille = await emp("emp-camille");
    const service = createReportingService(container());
    const filters = {
      preset: "personnalise" as const,
      startDate: "2025-01-01",
      endDate: "2026-12-31",
    };
    const dash = await service.getDashboard(
      sessionFor(camille, "admin_rh"),
      filters,
    );
    const { rowCount } = await buildWorkbook(
      container(),
      "planning_absences",
      parseReportingFilters(filters),
    );
    expect(rowCount).toBe(dash.kpis.demandesCongesApprouvees);
  });

  it("génère l'historique avec types de demande distincts", async () => {
    const filters = parseReportingFilters({
      preset: "personnalise",
      startDate: "2025-01-01",
      endDate: "2026-12-31",
    });
    const { buffer, rowCount } = await buildWorkbook(
      container(),
      "historique",
      filters,
    );
    expect(rowCount).toBeGreaterThan(0);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Uint8Array.from(buffer) as never);
    const headers = (wb.worksheets[0].getRow(1).values as string[]).filter(
      Boolean,
    );
    expect(headers[0]).toBe("Type de demande");
  });
});
