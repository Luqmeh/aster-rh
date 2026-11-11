/**
 * Limites télétravail — règles **produit** ASTER (présentation Conseil).
 * Pas des obligations du Code du travail marocain.
 *
 * Paramétrables via variables d'environnement (déploiement) :
 * - ASTER_TELEWORK_MAX_DAYS_PER_WEEK (défaut 2)
 * - ASTER_TELEWORK_MAX_DAYS_PER_MONTH (défaut 12)
 */

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  max = 31,
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

export type TeleworkLimits = {
  maxDaysPerWeek: number;
  maxDaysPerMonth: number;
  source: "env" | "default";
};

export function resolveTeleworkLimits(
  env: Record<string, string | undefined> = process.env,
): TeleworkLimits {
  const weekRaw = env.ASTER_TELEWORK_MAX_DAYS_PER_WEEK;
  const monthRaw = env.ASTER_TELEWORK_MAX_DAYS_PER_MONTH;
  const fromEnv = weekRaw != null || monthRaw != null;
  return {
    maxDaysPerWeek: parsePositiveInt(weekRaw, 2, 7),
    maxDaysPerMonth: parsePositiveInt(monthRaw, 12, 31),
    source: fromEnv ? "env" : "default",
  };
}

/** Valeurs courantes (résolues une fois au chargement du module serveur). */
export const TELEWORK_LIMITS = resolveTeleworkLimits();

export const MAX_TELEWORK_DAYS_PER_WEEK = TELEWORK_LIMITS.maxDaysPerWeek;
export const MAX_TELEWORK_DAYS_PER_MONTH = TELEWORK_LIMITS.maxDaysPerMonth;
