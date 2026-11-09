import { describe, expect, it } from "vitest";
import {
  assertRangeWithinLimit,
  isDateInRange,
  moroccoToday,
  resolveReportPeriod,
  reportFilename,
} from "@/domain/rules/reporting";

describe("reporting date rules (Africa/Casablanca)", () => {
  it("résout ce mois et mois précédent depuis une date fixe", () => {
    const now = new Date("2026-11-09T12:00:00+01:00");
    const month = resolveReportPeriod("ce_mois", null, null, now);
    expect(month.startDate).toBe("2026-11-01");
    expect(month.endDate).toBe(moroccoToday(now));

    const prev = resolveReportPeriod("mois_precedent", null, null, now);
    expect(prev.startDate).toBe("2026-10-01");
    expect(prev.endDate).toBe("2026-10-31");
  });

  it("résout trimestre et année", () => {
    const now = new Date("2026-11-09T12:00:00+01:00");
    const q = resolveReportPeriod("ce_trimestre", null, null, now);
    expect(q.startDate).toBe("2026-10-01");
    const y = resolveReportPeriod("cette_annee", null, null, now);
    expect(y.startDate).toBe("2026-01-01");
  });

  it("valide la plage personnalisée et refuse l'inversion", () => {
    const custom = resolveReportPeriod(
      "personnalise",
      "2026-01-01",
      "2026-01-31",
    );
    expect(custom.startDate).toBe("2026-01-01");
    expect(() =>
      resolveReportPeriod("personnalise", "2026-02-01", "2026-01-01"),
    ).toThrow(/fin/);
  });

  it("borne les exports trop larges", () => {
    expect(() =>
      assertRangeWithinLimit("2020-01-01", "2026-12-31"),
    ).toThrow(/trop large/);
  });

  it("teste l'appartenance à une plage", () => {
    expect(isDateInRange("2026-11-05", "2026-11-01", "2026-11-30")).toBe(true);
    expect(isDateInRange("2026-10-31", "2026-11-01", "2026-11-30")).toBe(false);
  });

  it("construit un nom de fichier d'export", () => {
    expect(reportFilename("conges_mois", "2026-11-09")).toBe(
      "ASTER_conges_mois_20261109.xlsx",
    );
  });
});
