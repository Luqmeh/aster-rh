import { PrismaClient } from "@prisma/client";
import {
  applyPrismaDatabaseEnvFallbacks,
  resolveDatabaseUrl,
} from "@/infrastructure/persistence/database-env";

const globalForPrisma = globalThis as unknown as {
  __asterPrisma?: PrismaClient;
};

/**
 * Client Prisma singleton — adapté Next.js (évite les multi-instances en hot reload).
 * Accès serveur uniquement.
 */
export function getPrismaClient(): PrismaClient {
  applyPrismaDatabaseEnvFallbacks();

  if (!resolveDatabaseUrl()) {
    throw new Error(
      "DATABASE_URL (ou POSTGRES_PRISMA_URL sur Vercel) est requis pour la persistance Prisma ASTER. Configurez la connexion PostgreSQL (voir .env.example et docs/DEPLOYMENT.md).",
    );
  }

  if (!globalForPrisma.__asterPrisma) {
    globalForPrisma.__asterPrisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
    });
  }

  return globalForPrisma.__asterPrisma;
}

/** Réservé aux tests d'intégration — ne pas utiliser en runtime applicatif. */
export function resetPrismaClientForTests(): void {
  const existing = globalForPrisma.__asterPrisma;
  globalForPrisma.__asterPrisma = undefined;
  void existing?.$disconnect();
}
