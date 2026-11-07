/**
 * Résolution des URLs PostgreSQL pour Prisma.
 *
 * Le schéma Prisma (v6) n’accepte qu’un seul `env("…")` par champ — pas de
 * fallback natif. On conserve donc `DATABASE_URL` / `DIRECT_URL` dans le schéma
 * (compat `.env.local`) et on mappe les variables générées par l’intégration
 * Supabase/Vercel lorsque ces noms canoniques sont absents :
 *
 * - `POSTGRES_PRISMA_URL` → `DATABASE_URL` (poolée, requêtes applicatives)
 * - `POSTGRES_URL_NON_POOLING` → `DIRECT_URL` (directe, migrations)
 */

export type EnvLike = Record<string, string | undefined>;

function firstNonEmpty(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** URL poolée pour le runtime Prisma Client (`datasource.url`). */
export function resolveDatabaseUrl(env: EnvLike = process.env): string | undefined {
  return firstNonEmpty(env.DATABASE_URL, env.POSTGRES_PRISMA_URL);
}

/** URL directe pour migrations / introspection (`datasource.directUrl`). */
export function resolveDirectUrl(env: EnvLike = process.env): string | undefined {
  return firstNonEmpty(env.DIRECT_URL, env.POSTGRES_URL_NON_POOLING);
}

/**
 * Aligne `process.env` (ou un objet env de test) sur les noms attendus par
 * `prisma/schema.prisma`, sans écraser une valeur locale déjà définie.
 */
export function applyPrismaDatabaseEnvFallbacks(
  env: EnvLike = process.env,
): void {
  const databaseUrl = resolveDatabaseUrl(env);
  const directUrl = resolveDirectUrl(env);

  if (databaseUrl && !env.DATABASE_URL?.trim()) {
    env.DATABASE_URL = databaseUrl;
  }
  if (directUrl && !env.DIRECT_URL?.trim()) {
    env.DIRECT_URL = directUrl;
  }
}
