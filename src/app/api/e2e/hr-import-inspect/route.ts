import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { HR_IMPORT_OPENING_SOURCE_KIND } from "@/domain/types/hr-import";
import { findAccountByEmployeeId } from "@/infrastructure/auth/account-store";
import { getContainer } from "@/infrastructure/container";
import { getHrImportBatch } from "@/infrastructure/persistence/hr-import-batch-store";

/**
 * Lecture seule réservée aux runs Playwright (`ASTER_E2E_INSPECT=1`).
 * Vérifie le magasin mémoire / ledger après un import UI — jamais exposé hors E2E.
 */
export async function GET(request: Request) {
  if (process.env.ASTER_E2E_INSPECT !== "1") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin_rh") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const url = new URL(request.url);
  const matricules = (url.searchParams.get("matricules") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const batchId = url.searchParams.get("batchId")?.trim() || null;
  const year = Number(url.searchParams.get("year") ?? "2026");

  const hr = getContainer().hr;
  const employees = [];
  for (const matricule of matricules) {
    const employee = await hr.getEmployee(matricule);
    const account = await findAccountByEmployeeId(matricule);
    const openings = employee
      ? (
          await hr.listLeaveLedgerEntries({
            employeeId: matricule,
            year: Number.isFinite(year) ? year : 2026,
          })
        ).filter((e) => e.sourceKind === HR_IMPORT_OPENING_SOURCE_KIND)
      : [];
    employees.push({
      matricule,
      found: Boolean(employee),
      firstName: employee?.firstName ?? null,
      lastName: employee?.lastName ?? null,
      email: employee?.email ?? null,
      account: account
        ? {
            email: account.email,
            role: account.role,
            mustChangePassword: account.mustChangePassword,
            isActive: account.isActive,
          }
        : null,
      openingLedger: openings.map((e) => ({
        account: e.account,
        quantity: e.quantity,
        unit: e.unit,
        sourceKind: e.sourceKind,
      })),
    });
  }

  const batch = batchId ? await getHrImportBatch(batchId) : null;

  return NextResponse.json({
    persistence: process.env.ASTER_PERSISTENCE ?? "memory",
    employees,
    batch: batch
      ? {
          id: batch.id,
          status: batch.status,
          executionReport: batch.executionReport,
        }
      : null,
  });
}
