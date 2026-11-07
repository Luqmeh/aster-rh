import { describe, expect, it } from "vitest";
import { formatDateFr, formatDateTimeFr } from "@/lib/utils";

describe("formatDateFr", () => {
  it("formate une date ISO (yyyy-mm-dd) en locale fr-FR sans décalage", () => {
    // 2026-12-21 doit rester le 21 décembre, pas le 20 (piège UTC/local).
    const formatted = formatDateFr("2026-12-21");
    expect(formatted).toMatch(/21/);
    expect(formatted.toLowerCase()).toMatch(/déc|dec/i);
    expect(formatted).toMatch(/2026/);
  });

  it("formate une autre date de façon stable", () => {
    const formatted = formatDateFr("2026-11-14");
    expect(formatted).toMatch(/14/);
    expect(formatted.toLowerCase()).toMatch(/nov/i);
    expect(formatted).toMatch(/2026/);
  });

  it("ne modifie pas la valeur source", () => {
    const source = "2026-08-03";
    formatDateFr(source);
    expect(source).toBe("2026-08-03");
  });
});

describe("formatDateTimeFr", () => {
  it("utilise la locale fr-FR", () => {
    const formatted = formatDateTimeFr("2026-11-02T09:15:00.000Z");
    expect(formatted).toMatch(/2026/);
    expect(formatted.length).toBeGreaterThan(8);
  });
});
