/**
 * Build Vercel ASTER :
 * 1. (Production uniquement) `prisma migrate deploy` via DIRECT_URL / POSTGRES_URL_NON_POOLING
 * 2. (Opt-in one-shot) seed démo si `ASTER_SEED_ON_BUILD=1` + Production
 * 3. `next build` avec `ASTER_BUILD_WITHOUT_DB=1` (SSG sans dépendance runtime DB)
 *
 * Les migrations ne s’exécutent PAS dans les serverless functions — uniquement
 * sur la machine de build Vercel (une fois par déploiement Production).
 * Prisma `migrate deploy` pose un verrou consultatif PostgreSQL contre les courses.
 *
 * Seed démo : désactivé par défaut ; one-shot via `ASTER_SEED_ON_BUILD=1` puis retirer la variable.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  getDatabaseEnvReadiness,
  loadDatabaseEnv,
} from "./load-database-env";
import { shouldRunHostedMigrateDeploy } from "./migrate-on-build-policy";
import { shouldRunHostedDemoSeed } from "./seed-on-build-policy";

function runNodeScript(scriptPath: string, args: string[]): void {
  const tsxCli = path.join(
    process.cwd(),
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs",
  );
  const result = spawnSync(
    process.execPath,
    [tsxCli, scriptPath, ...args],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNextBuild(): void {
  const nextBin = path.join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const env = {
    ...process.env,
    ASTER_BUILD_WITHOUT_DB: "1",
    // Placeholder build-only if AUTH_SECRET absent — runtime Vercel doit définir un vrai secret.
    AUTH_SECRET:
      process.env.AUTH_SECRET?.trim() ||
      "aster-build-placeholder-not-for-runtime",
  };
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

loadDatabaseEnv();

const decision = shouldRunHostedMigrateDeploy();
console.log(`ASTER migrate policy: ${decision.reason}`);

if (decision.run) {
  const readiness = getDatabaseEnvReadiness();
  if (!readiness.hasDatabaseUrl || !readiness.hasDirectUrl) {
    console.error(
      "Échec déploiement : migrations requises mais variables DB absentes.",
    );
    console.error(
      `État : database=${readiness.sourceDatabase}, direct=${readiness.sourceDirect}`,
    );
    console.error(
      "Sur Vercel Production, l’intégration Supabase doit fournir POSTGRES_PRISMA_URL + POSTGRES_URL_NON_POOLING.",
    );
    process.exit(1);
  }

  console.log(
    `ASTER migrate deploy — database=${readiness.sourceDatabase}, direct=${readiness.sourceDirect} (valeurs non affichées)`,
  );

  // generate avant migrate (postinstall peut être omis selon l’install Vercel)
  runNodeScript(path.join("scripts", "with-prisma-env.ts"), ["generate"]);
  runNodeScript(path.join("scripts", "with-prisma-env.ts"), [
    "migrate",
    "deploy",
  ]);
} else {
  console.log(
    "ASTER migrate deploy ignoré pour ce build (Preview/local par défaut).",
  );
}

const seedDecision = shouldRunHostedDemoSeed();
console.log(`ASTER seed policy: ${seedDecision.reason}`);

if (seedDecision.run) {
  const readiness = getDatabaseEnvReadiness();
  if (!readiness.hasDatabaseUrl || !readiness.hasDirectUrl) {
    console.error(
      "Échec seed one-shot : variables DB absentes (POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING).",
    );
    process.exit(1);
  }
  console.log(
    "ASTER demo seed one-shot (idempotent, sans DELETE) — puis vérification Léa/Julien/Camille.",
  );
  runNodeScript(path.join("prisma", "seed.ts"), []);
  runNodeScript(path.join("scripts", "verify-demo-seed.ts"), []);
  console.log(
    "Retirez ASTER_SEED_ON_BUILD de Vercel Production après ce déploiement.",
  );
} else {
  console.log("ASTER demo seed ignoré (opt-in ASTER_SEED_ON_BUILD=1 requis).");
}

runNextBuild();
