/**
 * Charge `.env` / `.env.local` (Next.js) puis mappe les variables Supabase/Vercel
 * vers les noms attendus par le schéma Prisma.
 */
import { loadEnvConfig } from "@next/env";
import { applyPrismaDatabaseEnvFallbacks } from "../src/infrastructure/persistence/database-env";

export function loadDatabaseEnv(cwd: string = process.cwd()): void {
  loadEnvConfig(cwd);
  applyPrismaDatabaseEnvFallbacks();
}

/** Indique si les URLs Prisma sont présentes (sans exposer leurs valeurs). */
export function getDatabaseEnvReadiness(env: NodeJS.ProcessEnv = process.env): {
  hasDatabaseUrl: boolean;
  hasDirectUrl: boolean;
  sourceDatabase: "DATABASE_URL" | "POSTGRES_PRISMA_URL" | "none";
  sourceDirect: "DIRECT_URL" | "POSTGRES_URL_NON_POOLING" | "none";
} {
  const hasCanonicalDatabase = Boolean(env.DATABASE_URL?.trim());
  const hasPrismaPostgres = Boolean(env.POSTGRES_PRISMA_URL?.trim());
  const hasCanonicalDirect = Boolean(env.DIRECT_URL?.trim());
  const hasNonPooling = Boolean(env.POSTGRES_URL_NON_POOLING?.trim());

  return {
    hasDatabaseUrl: hasCanonicalDatabase || hasPrismaPostgres,
    hasDirectUrl: hasCanonicalDirect || hasNonPooling,
    sourceDatabase: hasCanonicalDatabase
      ? "DATABASE_URL"
      : hasPrismaPostgres
        ? "POSTGRES_PRISMA_URL"
        : "none",
    sourceDirect: hasCanonicalDirect
      ? "DIRECT_URL"
      : hasNonPooling
        ? "POSTGRES_URL_NON_POOLING"
        : "none",
  };
}
