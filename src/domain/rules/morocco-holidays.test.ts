import { describe, expect, it } from "vitest";
import {
  findCuratedHolidayByDate,
  listCuratedMoroccoHolidays,
  MOROCCO_HOLIDAY_DATASET_VERSION,
} from "@/data/morocco-holidays";
import { mergeHolidaysWithOverrides } from "@/domain/rules/morocco-holidays";

describe("morocco holidays dataset", () => {
  it("inclut les fêtes nationales fixes 2026", () => {
    const holidays = listCuratedMoroccoHolidays([2026]);
    expect(findCuratedHolidayByDate("2026-01-01")?.nameFr).toMatch(/Nouvel An/i);
    expect(findCuratedHolidayByDate("2026-01-14")?.sourceKey).toBe(
      "amazigh_new_year",
    );
    expect(findCuratedHolidayByDate("2026-10-31")?.sourceKey).toBe("unity_day");
    expect(holidays.every((h) => h.date.startsWith("2026"))).toBe(true);
    expect(MOROCCO_HOLIDAY_DATASET_VERSION).toBeTruthy();
  });

  it("marque les fêtes religieuses 2026 confirmées et 2027 provisoires", () => {
    const fitr2026 = findCuratedHolidayByDate("2026-03-20");
    expect(fitr2026?.kind).toBe("religious");
    expect(fitr2026?.confirmation).toBe("confirmed");
    const fitr2027 = findCuratedHolidayByDate("2027-03-10");
    expect(fitr2027?.confirmation).toBe("provisional");
  });

  it("évite les doublons et applique les overrides RH", () => {
    const merged = mergeHolidaysWithOverrides([2026], [
      {
        id: "ov-1",
        sourceKey: "company_bridge",
        date: "2026-12-24",
        nameFr: "Pont entreprise (démo)",
        kind: "company",
        confirmation: "confirmed",
        isActive: true,
        year: 2026,
      },
      {
        id: "ov-2",
        sourceKey: "throne_day",
        date: "2026-07-30",
        nameFr: "Fête du Trône (corrigée)",
        kind: "national",
        confirmation: "confirmed",
        isActive: true,
        year: 2026,
      },
    ]);
    expect(merged.filter((h) => h.sourceKey === "throne_day")).toHaveLength(1);
    expect(
      merged.find((h) => h.sourceKey === "throne_day")?.nameFr,
    ).toContain("corrigée");
    expect(merged.some((h) => h.sourceKey === "company_bridge")).toBe(true);
  });
});
