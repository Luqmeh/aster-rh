/**
 * Seed CLI ASTER — idempotent (`resetMutable: false`).
 * Usage : npm run db:seed (nécessite DATABASE_URL + DIRECT_URL,
 * ou POSTGRES_PRISMA_URL + POSTGRES_URL_NON_POOLING sur Vercel).
 */
import { PrismaClient } from "@prisma/client";
import { seedAsterDemoData } from "../src/infrastructure/persistence/demo-data-lifecycle";
import {
  getDatabaseEnvReadiness,
  loadDatabaseEnv,
} from "../scripts/load-database-env";

async function main() {
  loadDatabaseEnv();
  const readiness = getDatabaseEnvReadiness();
  if (!readiness.hasDatabaseUrl || !readiness.hasDirectUrl) {
    throw new Error(
      `Variables DB manquantes (database=${readiness.sourceDatabase}, direct=${readiness.sourceDirect}). Utilisez le projet Supabase ASTER dédié dans .env.local.`,
    );
  }

  const prisma = new PrismaClient();
  try {
    await seedAsterDemoData(prisma, { resetMutable: false });
    console.log("Seed ASTER terminé (idempotent).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Échec du seed ASTER:", error);
  process.exit(1);
});
