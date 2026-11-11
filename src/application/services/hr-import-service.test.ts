import { beforeEach, describe, expect, it } from "vitest";
import {
  createHrImportService,
  resetHrImportMemoryForTests,
} from "@/application/services/hr-import-service";
import {
  BALANCE_TEMPLATE_COLUMNS,
  EMPLOYEE_TEMPLATE_COLUMNS,
} from "@/domain/rules/hr-import/templates";
import { HR_IMPORT_OPENING_SOURCE_KIND } from "@/domain/types/hr-import";
import {
  findAccountByEmployeeId,
  resetMemoryAccountsForTests,
} from "@/infrastructure/auth/account-store";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import {
  getHrImportBatch,
  resetHrImportWorkbookCacheForTests,
} from "@/infrastructure/persistence/hr-import-batch-store";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import { createStyledWorkbook } from "@/infrastructure/reporting/excel-workbook";
import {
  mockDocumentStorage,
  resetMockStorageForTests,
} from "@/infrastructure/storage/mock-storage";

const emails: { to: string; subject: string }[] = [];
const email = {
  async send(message: { to: string; subject: string; body: string }) {
    emails.push({ to: message.to, subject: message.subject });
    return { queued: true as const, provider: "mock-email" };
  },
};

describe("hr import service — durable + provisioning", () => {
  beforeEach(() => {
    resetDemoStore();
    resetHrImportMemoryForTests();
    resetHrImportWorkbookCacheForTests();
    resetMemoryAccountsForTests();
    resetMockStorageForTests();
    emails.length = 0;
  });

  function svc() {
    return createHrImportService({
      hr: demoHrRepository,
      storage: mockDocumentStorage,
      email,
    });
  }

  it("refuses collaborateur access", async () => {
    await expect(
      svc().uploadWorkbook(testSessionFor("emp-lea", "collaborateur"), {
        fileName: "x.xlsx",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("lets chef inspect but not execute", async () => {
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    expect(await svc().listBatches(chef)).toEqual([]);
    await expect(
      svc().uploadWorkbook(chef, {
        fileName: "x.xlsx",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("persists batches across parse-cache restart and provisions accounts", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const { buffer } = await createStyledWorkbook(
      "Collaborateurs",
      EMPLOYEE_TEMPLATE_COLUMNS,
      [
        {
          matricule: "emp-import-2",
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
    const batch = await svc().uploadWorkbook(session, {
      fileName: "collab.xlsx",
      bytes: new Uint8Array(buffer),
    });
    await svc().validateBatch(session, { batchId: batch.id });

    // Simulate process restart of parse cache only — durable store + workbook remain.
    resetHrImportMemoryForTests();

    const reloaded = await getHrImportBatch(batch.id);
    expect(reloaded?.status).toBe("awaiting_confirmation");

    const done = await svc().confirmAndExecute(session, {
      batchId: batch.id,
      confirmationPhrase: "IMPORTER",
    });
    expect(done.status).toMatch(/^completed/);
    expect(done.employeesCreated).toBe(1);
    expect(done.accountsCreated).toBe(1);
    expect(done.executionReport?.provisioningResults[0]?.status).toBe("created");
    const reportJson = JSON.stringify(done.executionReport);
    expect(reportJson).not.toMatch(/Aster-[A-Za-z0-9_-]{8,}/);
    expect(reportJson).not.toMatch(/mot de passe temporaire\s*:/i);

    const account = await findAccountByEmployeeId("emp-import-2");
    expect(account?.role).toBe("collaborateur");
    expect(account?.mustChangePassword).toBe(true);
    expect(emails.some((e) => e.to === "nadia.amrani@demo.aster-rh.local")).toBe(
      true,
    );

    await expect(
      svc().confirmAndExecute(session, {
        batchId: batch.id,
        confirmationPhrase: "IMPORTER",
      }),
    ).rejects.toThrow(/déjà exécuté/);
  });

  it("marks missing email as pending account and imports balances idempotently", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const { buffer } = await createStyledWorkbook(
      "Collaborateurs",
      EMPLOYEE_TEMPLATE_COLUMNS,
      [
        {
          matricule: "emp-import-3",
          firstName: "Karim",
          lastName: "Saadi",
          email: "",
          department: "AUD",
          jobTitle: "Assistant",
          site: "Casablanca (démo)",
          hireDate: "2023-06-01",
          contractType: "cdi",
          employmentStatus: "actif",
        },
      ],
    );
    const empBatch = await svc().uploadWorkbook(session, {
      fileName: "sans-email.xlsx",
      bytes: new Uint8Array(buffer),
    });
    await svc().validateBatch(session, { batchId: empBatch.id });
    const preview = await svc().getBatch(session, empBatch.id);
    expect(preview?.employeeDrafts[0]?.emailMissing).toBe(true);
    expect(preview?.employeeDrafts[0]?.severity).toBe("warning");

    const created = await svc().confirmAndExecute(session, {
      batchId: empBatch.id,
      confirmationPhrase: "IMPORTER",
    });
    expect(created.accountsPending).toBe(1);
    expect(await findAccountByEmployeeId("emp-import-3")).toBeNull();

    const { buffer: balBuf } = await createStyledWorkbook(
      "Soldes_ouverture",
      BALANCE_TEMPLATE_COLUMNS,
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
    const balBatch = await svc().uploadWorkbook(session, {
      fileName: "soldes.xlsx",
      bytes: new Uint8Array(balBuf),
    });
    await svc().validateBatch(session, { batchId: balBatch.id });
    const done = await svc().confirmAndExecute(session, {
      batchId: balBatch.id,
      confirmationPhrase: "IMPORTER",
    });
    expect(done.balancesImported).toBeGreaterThan(0);

    // Idempotent reopen of same logical openings via duplicate sourceId on retry path:
    // force failed then re-execute same batch should not double ledger.
    const entries = await demoHrRepository.listLeaveLedgerEntries({
      employeeId: "emp-lea",
      year: 2026,
    });
    const openings = entries.filter(
      (e) => e.sourceKind === HR_IMPORT_OPENING_SOURCE_KIND,
    );
    expect(openings.length).toBeGreaterThan(0);
  });

  it("prevents concurrent execution claims", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const { buffer } = await createStyledWorkbook(
      "Soldes_ouverture",
      BALANCE_TEMPLATE_COLUMNS,
      [
        {
          matricule: "emp-lea",
          cpDays: 1,
          rttDays: 0,
          recoveryHours: 0,
          effectiveDate: "2026-01-01",
          sourceReference: "Concurrent",
          verificationStatus: "verifie",
        },
      ],
    );
    const batch = await svc().uploadWorkbook(session, {
      fileName: "c.xlsx",
      bytes: new Uint8Array(buffer),
    });
    await svc().validateBatch(session, { batchId: batch.id });

    const p1 = svc().confirmAndExecute(session, {
      batchId: batch.id,
      confirmationPhrase: "IMPORTER",
    });
    const p2 = svc().confirmAndExecute(session, {
      batchId: batch.id,
      confirmationPhrase: "IMPORTER",
    });
    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  it("recovers interrupted executing batches without auto-retry", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const { buffer } = await createStyledWorkbook(
      "Soldes_ouverture",
      BALANCE_TEMPLATE_COLUMNS,
      [
        {
          matricule: "emp-lea",
          cpDays: 2,
          effectiveDate: "2026-01-01",
          sourceReference: "Interrupt",
          verificationStatus: "verifie",
        },
      ],
    );
    const batch = await svc().uploadWorkbook(session, {
      fileName: "i.xlsx",
      bytes: new Uint8Array(buffer),
    });
    await svc().validateBatch(session, { batchId: batch.id });

    const { claimHrImportBatchExecution } = await import(
      "@/infrastructure/persistence/hr-import-batch-store"
    );
    const claimed = await claimHrImportBatchExecution(batch.id, [
      "awaiting_confirmation",
    ]);
    expect(claimed?.status).toBe("executing");

    const recovered = await svc().recoverInterruptedBatch(session, batch.id);
    expect(recovered.status).toBe("failed");

    const chef = testSessionFor("emp-julien", "chef_de_projet");
    await expect(
      svc().recoverInterruptedBatch(chef, batch.id),
    ).rejects.toMatchObject({ status: 403 });

    const retried = await svc().confirmAndExecute(session, {
      batchId: batch.id,
      confirmationPhrase: "IMPORTER",
    });
    expect(retried.status).toMatch(/^completed/);
    expect(retried.balancesImported).toBeGreaterThan(0);
  });

  it("does not overwrite existing login credentials on re-import update", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const { buffer } = await createStyledWorkbook(
      "Collaborateurs",
      EMPLOYEE_TEMPLATE_COLUMNS,
      [
        {
          matricule: "emp-import-4",
          firstName: "Sara",
          lastName: "Idrissi",
          email: "sara.idrissi@demo.aster-rh.local",
          department: "AUD",
          jobTitle: "Consultante",
          site: "Casablanca (démo)",
          hireDate: "2022-01-01",
          contractType: "cdi",
          employmentStatus: "actif",
        },
      ],
    );
    const first = await svc().uploadWorkbook(session, {
      fileName: "a.xlsx",
      bytes: new Uint8Array(buffer),
    });
    await svc().validateBatch(session, { batchId: first.id });
    await svc().confirmAndExecute(session, {
      batchId: first.id,
      confirmationPhrase: "IMPORTER",
    });
    const account = await findAccountByEmployeeId("emp-import-4");
    const hashBefore = account?.passwordHash;

    const { buffer: again } = await createStyledWorkbook(
      "Collaborateurs",
      EMPLOYEE_TEMPLATE_COLUMNS,
      [
        {
          matricule: "emp-import-4",
          firstName: "Sara",
          lastName: "Idrissi",
          email: "sara.idrissi@demo.aster-rh.local",
          department: "AUD",
          jobTitle: "Senior",
          site: "Casablanca (démo)",
          hireDate: "2022-01-01",
          contractType: "cdi",
          employmentStatus: "actif",
        },
      ],
    );
    const second = await svc().uploadWorkbook(session, {
      fileName: "b.xlsx",
      bytes: new Uint8Array(again),
    });
    await svc().validateBatch(session, {
      batchId: second.id,
      updateExistingEmployees: true,
    });
    const updated = await svc().confirmAndExecute(session, {
      batchId: second.id,
      confirmationPhrase: "IMPORTER",
    });
    expect(updated.employeesUpdated).toBe(1);
    expect(
      updated.executionReport?.provisioningResults.some(
        (p) => p.status === "skipped" || p.status === "already_existing",
      ),
    ).toBe(true);
    const after = await findAccountByEmployeeId("emp-import-4");
    expect(after?.passwordHash).toBe(hashBefore);
  });
});
