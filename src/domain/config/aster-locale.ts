/**
 * Configuration locale par défaut — ASTER département Maroc.
 * L’UI reste en français ; ce n’est pas une localisation FR métropole.
 */

export const ASTER_COUNTRY_CODE = "MA" as const;
export const ASTER_COUNTRY_NAME_FR = "Maroc";
export const ASTER_TIMEZONE = "Africa/Casablanca";
export const ASTER_LOCALE = "fr-MA";
export const ASTER_CURRENCY = "MAD";
export const ASTER_CURRENCY_NAME_FR = "dirham marocain";

/** Référence légale couramment citée (durée du travail) — alerte RH, pas paie. */
export const MOROCCO_LEGAL_WEEKLY_HOURS_REFERENCE = 44;

/** Week-end produit par défaut (sam–dim, JS getDay). Sites ven–sam : config RH. */
export const DEFAULT_WEEKEND_JS_DAYS = [0, 6] as const;

export function formatMoneyMad(
  amount: number,
  locale: string = ASTER_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: ASTER_CURRENCY,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateMa(
  isoDate: string,
  locale: string = ASTER_LOCALE,
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat(locale, {
    timeZone: ASTER_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatNumberMa(
  value: number,
  fractionDigits = 1,
  locale: string = ASTER_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
