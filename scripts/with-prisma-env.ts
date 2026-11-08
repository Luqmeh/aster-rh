/**
 * Charge l’env locale, applique le mapping Vercel Supabase → noms Prisma,
 * puis exécute la CLI Prisma.
 * Usage : tsx scripts/with-prisma-env.ts migrate deploy
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  getDatabaseEnvReadiness,
  loadDatabaseEnv,
} from "./load-database-env";

loadDatabaseEnv();

const readiness = getDatabaseEnvReadiness();
if (!readiness.hasDatabaseUrl || !readiness.hasDirectUrl) {
  console.error(
    "Variables DB manquantes pour Prisma. Attendu : DATABASE_URL + DIRECT_URL (local) ou POSTGRES_PRISMA_URL + POSTGRES_URL_NON_POOLING (Vercel/Supabase).",
  );
  console.error(
    `État : database=${readiness.sourceDatabase}, direct=${readiness.sourceDirect}`,
  );
  console.error(
    "Placez les credentials du projet Supabase ASTER dédié dans .env.local (gitignored), puis réessayez.",
  );
  process.exit(1);
}

const prismaArgs = process.argv.slice(2);
if (prismaArgs.length === 0) {
  console.error("Usage: tsx scripts/with-prisma-env.ts <prisma-args…>");
  process.exit(1);
}

const prismaCli = path.join(
  process.cwd(),
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
