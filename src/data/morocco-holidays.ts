/**
 * Jeu de données versionné — jours fériés nationaux et religieux du Maroc.
 *
 * Sources :
 * - https://www.maroc.ma/en/morocco/religious-and-national-holidays
 * - https://www.mmsp.gov.ma/fr/nos-metiers/horaires-de-travail-et-jours-fériés
 *
 * Les fêtes religieuses suivent le calendrier hijri (annonce Ministère des Habous).
 * Les dates futures non confirmées sont marquées `provisional`.
 *
 * Version dataset : 2026-11-09
 */

export type HolidayKind = "national" | "religious" | "company";
export type HolidayConfirmation = "confirmed" | "provisional";

export type MoroccoHolidaySeed = {
  /** Clé stable pour éviter les doublons au refresh. */
  sourceKey: string;
  name: string;
  nameFr: string;
  kind: HolidayKind;
  /** mm-dd pour fêtes fixes ; null pour religieuses (date complète fournie). */
  fixedMd?: string;
  /** Dates civiles connues / estimées par année. */
  occurrences: Record<
    number,
    { date: string; confirmation: HolidayConfirmation }
  >;
};

export const MOROCCO_HOLIDAY_DATASET_VERSION = "2026-11-09";

/** Fêtes nationales à date civile fixe. */
const FIXED_NATIONAL: Array<{
  sourceKey: string;
  name: string;
  nameFr: string;
  fixedMd: string;
}> = [
  {
    sourceKey: "new_year",
    name: "New Year's Day",
    nameFr: "Nouvel An",
    fixedMd: "01-01",
  },
  {
    sourceKey: "independence_manifesto",
    name: "Independence Manifesto Day",
    nameFr: "Manifeste de l'Indépendance",
    fixedMd: "01-11",
  },
  {
    sourceKey: "amazigh_new_year",
    name: "Amazigh New Year",
    nameFr: "Nouvel An amazigh (Yennayer)",
    fixedMd: "01-14",
  },
  {
    sourceKey: "labour_day",
    name: "Labour Day",
    nameFr: "Fête du Travail",
    fixedMd: "05-01",
  },
  {
    sourceKey: "throne_day",
    name: "Throne Day",
    nameFr: "Fête du Trône",
    fixedMd: "07-30",
  },
  {
    sourceKey: "oued_eddahab",
    name: "Oued Eddahab Day",
    nameFr: "Récupération de Oued Eddahab",
    fixedMd: "08-14",
  },
  {
    sourceKey: "revolution_king_people",
    name: "Revolution of the King and the People",
    nameFr: "Révolution du Roi et du Peuple",
    fixedMd: "08-20",
  },
  {
    sourceKey: "youth_day",
    name: "Youth Day",
    nameFr: "Fête de la Jeunesse",
    fixedMd: "08-21",
  },
  {
    sourceKey: "unity_day",
    name: "Unity Day / Aid Al Wahda",
    nameFr: "Aid Al Wahda (Fête de l'Unité)",
    fixedMd: "10-31",
  },
  {
    sourceKey: "green_march",
    name: "Green March",
    nameFr: "Marche Verte",
    fixedMd: "11-06",
  },
  {
    sourceKey: "independence_day",
    name: "Independence Day",
    nameFr: "Fête de l'Indépendance",
    fixedMd: "11-18",
  },
];

/**
 * Occurrences religieuses — 2025/2026 confirmées (annonces Habous / archives),
 * 2027 provisoires (estimation astronomique, sous réserve de la vue du croissant).
 */
const RELIGIOUS: MoroccoHolidaySeed[] = [
  {
    sourceKey: "eid_fitr_d1",
    name: "Eid Al-Fitr (day 1)",
    nameFr: "Aïd Al-Fitr (jour 1)",
    kind: "religious",
    occurrences: {
      2025: { date: "2025-03-31", confirmation: "confirmed" },
      2026: { date: "2026-03-20", confirmation: "confirmed" },
      2027: { date: "2027-03-10", confirmation: "provisional" },
    },
  },
  {
    sourceKey: "eid_fitr_d2",
    name: "Eid Al-Fitr (day 2)",
    nameFr: "Aïd Al-Fitr (jour 2)",
    kind: "religious",
    occurrences: {
      2025: { date: "2025-04-01", confirmation: "confirmed" },
      2026: { date: "2026-03-21", confirmation: "confirmed" },
      2027: { date: "2027-03-11", confirmation: "provisional" },
    },
  },
  {
    sourceKey: "eid_adha_d1",
    name: "Eid Al-Adha (day 1)",
    nameFr: "Aïd Al-Adha (jour 1)",
    kind: "religious",
    occurrences: {
      2025: { date: "2025-06-07", confirmation: "confirmed" },
      2026: { date: "2026-05-27", confirmation: "confirmed" },
      2027: { date: "2027-05-17", confirmation: "provisional" },
    },
  },
  {
    sourceKey: "eid_adha_d2",
    name: "Eid Al-Adha (day 2)",
    nameFr: "Aïd Al-Adha (jour 2)",
    kind: "religious",
    occurrences: {
      2025: { date: "2025-06-08", confirmation: "confirmed" },
      2026: { date: "2026-05-28", confirmation: "confirmed" },
      2027: { date: "2027-05-18", confirmation: "provisional" },
    },
  },
  {
    sourceKey: "islamic_new_year",
    name: "Islamic New Year",
    nameFr: "Nouvel An hijri (1er Mouharram)",
    kind: "religious",
    occurrences: {
      2025: { date: "2025-06-27", confirmation: "confirmed" },
      2026: { date: "2026-06-17", confirmation: "confirmed" },
      2027: { date: "2027-06-06", confirmation: "provisional" },
    },
  },
  {
    sourceKey: "mawlid_d1",
    name: "Eid Al-Mawlid (day 1)",
    nameFr: "Aïd Al-Mawlid (jour 1)",
    kind: "religious",
    occurrences: {
      2025: { date: "2025-09-05", confirmation: "confirmed" },
      2026: { date: "2026-08-25", confirmation: "confirmed" },
      2027: { date: "2027-08-15", confirmation: "provisional" },
    },
  },
  {
    sourceKey: "mawlid_d2",
    name: "Eid Al-Mawlid (day 2)",
    nameFr: "Aïd Al-Mawlid (jour 2)",
    kind: "religious",
    occurrences: {
      2025: { date: "2025-09-06", confirmation: "confirmed" },
      2026: { date: "2026-08-26", confirmation: "confirmed" },
      2027: { date: "2027-08-16", confirmation: "provisional" },
    },
  },
];

export type ResolvedHoliday = {
  sourceKey: string;
  date: string;
  year: number;
  name: string;
  nameFr: string;
  kind: HolidayKind;
  confirmation: HolidayConfirmation;
};

function yearsCovered(): number[] {
  return [2025, 2026, 2027, 2028];
}

export function listCuratedMoroccoHolidays(
  years: number[] = yearsCovered(),
): ResolvedHoliday[] {
  const out: ResolvedHoliday[] = [];
  const yearSet = new Set(years);

  for (const year of years) {
    for (const fixed of FIXED_NATIONAL) {
      // Unity Day applies from 2026
      if (fixed.sourceKey === "unity_day" && year < 2026) continue;
      out.push({
        sourceKey: fixed.sourceKey,
        date: `${year}-${fixed.fixedMd}`,
        year,
        name: fixed.name,
        nameFr: fixed.nameFr,
        kind: "national",
        confirmation: "confirmed",
      });
    }
  }

  for (const religious of RELIGIOUS) {
    for (const [yearStr, occ] of Object.entries(religious.occurrences)) {
      const year = Number(yearStr);
      if (!yearSet.has(year)) continue;
      out.push({
        sourceKey: religious.sourceKey,
        date: occ.date,
        year,
        name: religious.name,
        nameFr: religious.nameFr,
        kind: "religious",
        confirmation: occ.confirmation,
      });
    }
  }

  // Déduplication par sourceKey+date
  const seen = new Set<string>();
  return out
    .filter((h) => {
      const key = `${h.sourceKey}:${h.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function findCuratedHolidayByDate(
  date: string,
): ResolvedHoliday | undefined {
  const year = Number(date.slice(0, 4));
  return listCuratedMoroccoHolidays([year]).find((h) => h.date === date);
}
