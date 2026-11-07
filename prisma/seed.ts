/**
 * Seed CLI ASTER — idempotent.
 * Usage : npm run db:seed (nécessite DATABASE_URL + DIRECT_URL,
 * ou POSTGRES_PRISMA_URL + POSTGRES_URL_NON_POOLING sur Vercel).
 */
import { PrismaClient } from "@prisma/client";
import { applyPrismaDatabaseEnvFallbacks } from "../src/infrastructure/persistence/database-env";
import { seedAsterDemoData } from "../src/infrastructure/persistence/demo-data-lifecycle";

async function main() {
  applyPrismaDatabaseEnvFallbacks();
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
