/**
 * Vérifie la présence des identités démo critiques (Léa, Julien, Camille)
 * sans afficher de secrets ni d’URLs.
 */
import { PrismaClient } from "@prisma/client";
import {
  getDatabaseEnvReadiness,
  loadDatabaseEnv,
} from "./load-database-env";

const REQUIRED_EMPLOYEES = [
  { id: "emp-lea", firstName: "Léa" },
  { id: "emp-julien", firstName: "Julien" },
  { id: "emp-camille", firstName: "Camille" },
] as const;

async function main() {
  loadDatabaseEnv();
  const readiness = getDatabaseEnvReadiness();
  if (!readiness.hasDatabaseUrl || !readiness.hasDirectUrl) {
    throw new Error(
      `Variables DB manquantes (database=${readiness.sourceDatabase}, direct=${readiness.sourceDirect}).`,
    );
  }

  const prisma = new PrismaClient();
  try {
    for (const expected of REQUIRED_EMPLOYEES) {
      const row = await prisma.employee.findUnique({
        where: { id: expected.id },
        select: { id: true, firstName: true, demoIdentityId: true },
      });
      if (!row) {
        throw new Error(`Employé démo manquant: ${expected.id}`);
      }
      if (row.firstName !== expected.firstName) {
        throw new Error(
          `Employé ${expected.id}: prénom inattendu (attendu ${expected.firstName}).`,
        );
      }
      console.log(`OK ${row.id} / ${row.firstName} / identity=${row.demoIdentityId ?? "none"}`);
    }

    const [employees, leaveBalances, leaveRequests, teleworkRequests] =
      await Promise.all([
        prisma.employee.count(),
        prisma.leaveBalance.count(),
        prisma.leaveRequest.count(),
        prisma.teleworkRequest.count(),
      ]);

    console.log(
      `Counts: employees=${employees} leaveBalances=${leaveBalances} leaveRequests=${leaveRequests} teleworkRequests=${teleworkRequests}`,
    );
    console.log("Vérification seed démo OK.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Échec vérification seed démo:", error);
  process.exit(1);
});
