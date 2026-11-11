import { describe, expect, it } from "vitest";
import {
  ASTER_CURRENCY,
  ASTER_LOCALE,
  ASTER_TIMEZONE,
  formatMoneyMad,
  MOROCCO_LEGAL_WEEKLY_HOURS_REFERENCE,
} from "@/domain/config/aster-locale";
import { listCuratedMoroccoHolidays } from "@/data/morocco-holidays";

describe("aster locale Morocco-first", () => {
  it("defaults to fr-MA, Africa/Casablanca and MAD", () => {
    expect(ASTER_LOCALE).toBe("fr-MA");
    expect(ASTER_TIMEZONE).toBe("Africa/Casablanca");
    expect(ASTER_CURRENCY).toBe("MAD");
    expect(MOROCCO_LEGAL_WEEKLY_HOURS_REFERENCE).toBe(44);
    expect(formatMoneyMad(100)).toMatch(/100/);
  });

  it("curated holidays are Moroccan (no Bastille Day / Assomption FR)", () => {
    const holidays = listCuratedMoroccoHolidays([2026]);
    const names = holidays.map((h) => h.nameFr.toLowerCase()).join(" | ");
    expect(names).not.toMatch(/bastille|assomption|14 juillet|1er novembre/);
    expect(holidays.some((h) => h.sourceKey === "throne_day")).toBe(true);
    expect(holidays.some((h) => h.sourceKey === "labour_day")).toBe(true);
  });
});
