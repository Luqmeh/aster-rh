/**
 * Applique le mapping Vercel Supabase → noms Prisma, puis exécute la CLI Prisma.
 * Usage : tsx scripts/with-prisma-env.ts migrate deploy
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { applyPrismaDatabaseEnvFallbacks } from "../src/infrastructure/persistence/database-env";

applyPrismaDatabaseEnvFallbacks();

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
