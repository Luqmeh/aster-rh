/**
 * Politique d’exécution de `prisma migrate deploy` pendant un build hébergé.
 *
 * - Production Vercel (`VERCEL_ENV=production`) : migrer.
 * - Preview / Development : ne pas migrer (évite d’altérer la base board
 *   depuis une branche non fusionnée qui partage les mêmes `POSTGRES_*`).
 * - Forçage explicite : `ASTER_MIGRATE_ON_BUILD=1` (uniquement avec une base dédiée).
 * - Opt-out : `ASTER_SKIP_MIGRATE=1`.
 */

export type EnvLike = Record<string, string | undefined>;

export type MigrateOnBuildDecision = {
  run: boolean;
  reason: string;
};

export function shouldRunHostedMigrateDeploy(
  env: EnvLike = process.env,
): MigrateOnBuildDecision {
  if (env.ASTER_SKIP_MIGRATE === "1") {
    return { run: false, reason: "ASTER_SKIP_MIGRATE=1" };
  }

  if (env.ASTER_MIGRATE_ON_BUILD === "1") {
    return { run: true, reason: "ASTER_MIGRATE_ON_BUILD=1" };
  }

  if (env.VERCEL_ENV === "production") {
    return { run: true, reason: "VERCEL_ENV=production" };
  }

  return {
    run: false,
    reason: `skipped (VERCEL_ENV=${env.VERCEL_ENV ?? "unset"})`,
  };
}
