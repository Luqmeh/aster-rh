/**
 * Seed CLI ASTER — idempotent.
 * Usage : npm run db:seed (nécessite DATABASE_URL + DIRECT_URL).
 */
import { PrismaClient } from "@prisma/client";
import { seedAsterDemoData } from "../src/infrastructure/persistence/demo-data-lifecycle";

async function main() {
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
