import { beforeEach, describe, expect, it } from "vitest";
import {
  createHrImportService,
  resetHrImportMemoryForTests,
} from "@/application/services/hr-import-service";
import { EMPLOYEE_TEMPLATE_COLUMNS } from "@/domain/rules/hr-import/templates";
import { createStyledWorkbook } from "@/infrastructure/reporting/excel-workbook";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import { HR_IMPORT_OPENING_SOURCE_KIND } from "@/domain/types/hr-import";

describe("hr import service", () => {
  beforeEach(() => {
    resetDemoStore();
    resetHrImportMemoryForTests();
  });

  it("refuses collaborateur access", async () => {
    const svc = createHrImportService({ hr: demoHrRepository });
    await expect(
      svc.uploadWorkbook(testSessionFor("emp-lea", "collaborateur"), {
        fileName: "x.xlsx",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("imports employees and opening balances idempotently", async () => {
    const svc = createHrImportService({ hr: demoHrRepository });
    const session = testSessionFor("emp-camille", "admin_rh");
    const { buffer } = await createStyledWorkbook(
      "Collaborateurs",
      EMPLOYEE_TEMPLATE_COLUMNS,
      [
        {
          matricule: "emp-import-1",
          firstName: "Nadia",
          lastName: "Amrani",
          email: "nadia.amrani@demo.aster-rh.local",
          department: "AUD",
          jobTitle: "Consultante",
          site: "Casablanca (démo)",
          hireDate: "2024-02-01",
          contractType: "cdi",
          employmentStatus: "actif",
          managerMatricule: "emp-julien",
        },
      ],
    );
    // Add balances sheet by merging via second workbook parse path — upload single sheet first
    const batch = await svc.uploadWorkbook(session, {
      fileName: "collab.xlsx",
      bytes: new Uint8Array(buffer),
    });
    await svc.validateBatch(session, { batchId: batch.id });
    const preview = svc.getBatch(session, batch.id)!;
    expect(preview.employeeDrafts[0]?.severity).toBe("ok");

    // Balance-only follow-up on existing emp-lea
    const { buffer: balBuf } = await createStyledWorkbook(
      "Soldes_ouverture",
      [
        { header: "matricule", key: "matricule" },
        { header: "solde_cp_jours", key: "cpDays" },
        { header: "solde_rtt_jours", key: "rttDays" },
        { header: "solde_recuperation_heures", key: "recoveryHours" },
        { header: "date_effet", key: "effectiveDate" },
        { header: "reference_source", key: "sourceReference" },
        { header: "statut_verification_rh", key: "verificationStatus" },
        { header: "notes", key: "notes" },
      ],
      [
        {
          matricule: "emp-lea",
          cpDays: 3,
          rttDays: 1,
          recoveryHours: 7,
          effectiveDate: "2026-01-01",
          sourceReference: "Inventaire test",
          verificationStatus: "verifie",
          notes: "",
        },
      ],
    );
    const balBatch = await svc.uploadWorkbook(session, {
      fileName: "soldes.xlsx",
      bytes: new Uint8Array(balBuf),
    });
    await svc.validateBatch(session, { batchId: balBatch.id });
    const ready = svc.getBatch(session, balBatch.id)!;
    expect(ready.balanceDrafts[0]?.severity).toBe("ok");

    const done = await svc.confirmAndExecute(session, {
      batchId: balBatch.id,
      confirmationPhrase: "IMPORTER",
    });
    expect(done.status).toBe("completed");
    expect(done.executionReport?.balancesImported).toBeGreaterThan(0);

    await expect(
      svc.confirmAndExecute(session, {
        batchId: balBatch.id,
        confirmationPhrase: "IMPORTER",
      }),
    ).rejects.toThrow(/déjà exécuté/);

    const entries = await demoHrRepository.listLeaveLedgerEntries({
      employeeId: "emp-lea",
      year: 2026,
    });
    const openings = entries.filter(
      (e) => e.sourceKind === HR_IMPORT_OPENING_SOURCE_KIND,
    );
    expect(openings.length).toBeGreaterThan(0);
  });

  it("lets chef inspect but not execute", async () => {
    const svc = createHrImportService({ hr: demoHrRepository });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    expect(svc.listBatches(chef)).toEqual([]);
    await expect(
      svc.uploadWorkbook(chef, {
        fileName: "x.xlsx",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
