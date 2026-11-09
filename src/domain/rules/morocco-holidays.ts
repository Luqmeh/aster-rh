import {
  findCuratedHolidayByDate,
  listCuratedMoroccoHolidays,
  type HolidayConfirmation,
  type HolidayKind,
  type ResolvedHoliday,
} from "@/data/morocco-holidays";

export type CalendarHoliday = ResolvedHoliday & {
  /** Entrée issue d'une correction / jour entreprise RH. */
  overridden?: boolean;
  overrideId?: string | null;
};

export type HolidayOverrideInput = {
  id?: string;
  sourceKey: string;
  date: string;
  nameFr: string;
  kind: HolidayKind;
  confirmation: HolidayConfirmation;
  isActive: boolean;
  year: number;
};

/** Fusion curated + overrides RH (override gagne sur même sourceKey+année). */
export function mergeHolidaysWithOverrides(
  years: number[],
  overrides: HolidayOverrideInput[],
): CalendarHoliday[] {
  const curated = listCuratedMoroccoHolidays(years);
  const byKey = new Map<string, CalendarHoliday>();

  for (const h of curated) {
    byKey.set(`${h.sourceKey}:${h.year}`, { ...h, overridden: false });
  }

  for (const o of overrides) {
    if (!o.isActive) {
      byKey.delete(`${o.sourceKey}:${o.year}`);
      continue;
    }
    byKey.set(`${o.sourceKey}:${o.year}`, {
      sourceKey: o.sourceKey,
      date: o.date,
      year: o.year,
      name: o.nameFr,
      nameFr: o.nameFr,
      kind: o.kind,
      confirmation: o.confirmation,
      overridden: true,
      overrideId: o.id ?? null,
    });
  }

  // Dédup visuelle par date+nom
  const seenDateName = new Set<string>();
  return [...byKey.values()]
    .filter((h) => years.includes(h.year))
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((h) => {
      const k = `${h.date}:${h.nameFr}`;
      if (seenDateName.has(k)) return false;
      seenDateName.add(k);
      return true;
    });
}

export function isPublicHolidayDate(
  date: string,
  holidays: CalendarHoliday[],
): CalendarHoliday | undefined {
  return holidays.find((h) => h.date === date);
}

export function requirePublicHoliday(
  date: string,
  holidays: CalendarHoliday[],
): CalendarHoliday {
  const hit = holidays.find((h) => h.date === date);
  if (!hit) {
    throw new Error(
      "La date sélectionnée n'est pas un jour férié reconnu.",
    );
  }
  return hit;
}

export function confirmationLabel(c: HolidayConfirmation): string {
  return c === "confirmed" ? "Confirmé" : "Provisoire";
}

export function holidayKindLabel(kind: HolidayKind): string {
  if (kind === "national") return "National";
  if (kind === "religious") return "Religieux";
  return "Entreprise";
}

/** Réexport utilitaire tests. */
export { findCuratedHolidayByDate, listCuratedMoroccoHolidays };
