/** Utilitaires de dates calendaires (yyyy-mm-dd, UTC) — sans décalage de fuseau. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  return DATE_RE.test(value);
}

export function isMonthKey(value: string): boolean {
  return MONTH_RE.test(value);
}

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthKeyFromDate(dateOnly: string): string {
  return dateOnly.slice(0, 7);
}

export function monthBounds(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const start = toDateOnly(new Date(Date.UTC(y, m - 1, 1)));
  const end = toDateOnly(new Date(Date.UTC(y, m, 0)));
  return { start, end };
}

export function isWeekend(dateOnly: string): boolean {
  const dow = parseDateOnly(dateOnly).getUTCDay();
  return dow === 0 || dow === 6;
}

export function isWeekday(dateOnly: string): boolean {
  return !isWeekend(dateOnly);
}

/** Semaine ISO (lundi = début) — clé stable yyyy-Www. */
export function isoWeekKey(dateOnly: string): string {
  const date = parseDateOnly(dateOnly);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function listDaysInMonth(monthKey: string): string[] {
  const { start, end } = monthBounds(monthKey);
  const days: string[] = [];
  const cursor = parseDateOnly(start);
  const last = parseDateOnly(end);
  while (cursor <= last) {
    days.push(toDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function listWeekdaysInMonth(monthKey: string): string[] {
  return listDaysInMonth(monthKey).filter(isWeekday);
}

export type MonthWeekBucket = {
  weekKey: string;
  label: string;
  days: string[];
};

/** Semaines du mois (lun–ven uniquement), y compris semaines à cheval. */
export function groupWeekdaysByIsoWeek(monthKey: string): MonthWeekBucket[] {
  const weekdays = listWeekdaysInMonth(monthKey);
  const map = new Map<string, string[]>();
  for (const day of weekdays) {
    const key = isoWeekKey(day);
    const list = map.get(key) ?? [];
    list.push(day);
    map.set(key, list);
  }
  return [...map.entries()].map(([weekKey, days]) => ({
    weekKey,
    label: weekLabelFr(days),
    days,
  }));
}

function weekLabelFr(days: string[]): string {
  if (days.length === 0) return "";
  const first = formatDayMonthFr(days[0]);
  const last = formatDayMonthFr(days[days.length - 1]);
  return `Semaine du ${first} au ${last}`;
}

export function formatDayMonthFr(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatMonthYearFr(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function nextMonthKey(now = new Date()): string {
  return addMonths(currentMonthKey(now), 1);
}

export function weekdayLabelFr(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Étend une période inclusive en jours calendaires. */
export function expandDateRange(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = parseDateOnly(startDate);
  const last = parseDateOnly(endDate);
  while (cursor <= last) {
    days.push(toDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export const FRENCH_WEEKDAY_SHORT = [
  "lun.",
  "mar.",
  "mer.",
  "jeu.",
  "ven.",
  "sam.",
  "dim.",
] as const;
