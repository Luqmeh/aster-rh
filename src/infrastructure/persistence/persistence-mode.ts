import { resolveDatabaseUrl } from "@/infrastructure/persistence/database-env";

export type PersistenceMode = "memory" | "prisma";

function isHostedRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production"
  );
}

function isNextProductionBuild(env: EnvLike): boolean {
  return (
    env.NEXT_PHASE === "phase-production-build" ||
    env.ASTER_BUILD_WITHOUT_DB === "1"
  );
}

/**
 * Résout le mode de persistance ASTER.
 *
 * - `ASTER_PERSISTENCE=prisma|memory` force le mode.
 * - Sinon : Prisma si `DATABASE_URL` ou `POSTGRES_PRISMA_URL` est défini, mémoire en local.
 * - En runtime hébergé / production : la mémoire est refusée sauf
 *   `ASTER_ALLOW_MEMORY=1` (secours local uniquement — jamais pour la démo board).
 * - Pendant `next build` (hors runtime), la mémoire reste autorisée sans DB
 *   pour respecter le build Vercel offline-capable.
 */
type EnvLike = Record<string, string | undefined>;

export function resolvePersistenceMode(
  env: EnvLike = process.env,
): PersistenceMode {
  const databaseUrl = resolveDatabaseUrl(env);
  const explicit = env.ASTER_PERSISTENCE?.trim().toLowerCase();
  if (explicit === "prisma" || explicit === "memory") {
    if (explicit === "prisma" && !databaseUrl) {
      throw new Error(
        "ASTER_PERSISTENCE=prisma mais DATABASE_URL (ou POSTGRES_PRISMA_URL) est absent. Configurez PostgreSQL avant de démarrer.",
      );
    }
    if (
      explicit === "memory" &&
      isHostedRuntimeEnv(env) &&
      !isNextProductionBuild(env) &&
      env.ASTER_ALLOW_MEMORY !== "1"
    ) {
      throw new Error(
        "Persistance mémoire interdite en production/Vercel. Définissez DATABASE_URL (ou POSTGRES_PRISMA_URL) et ASTER_PERSISTENCE=prisma.",
      );
    }
    return explicit;
  }

  if (databaseUrl) {
    return "prisma";
  }

  if (
    isHostedRuntimeEnv(env) &&
    !isNextProductionBuild(env) &&
    env.ASTER_ALLOW_MEMORY !== "1"
  ) {
    throw new Error(
      "Aucune DATABASE_URL / POSTGRES_PRISMA_URL en environnement hébergé. La démo ASTER board doit utiliser PostgreSQL (Prisma).",
    );
  }

  return "memory";
}

function isHostedRuntimeEnv(env: EnvLike): boolean {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}

export function isDemoModeEnabled(env: EnvLike = process.env): boolean {
  const mode = (env.ASTER_MODE ?? "demo").trim().toLowerCase();
  return mode === "demo";
}

export { isHostedRuntime };
