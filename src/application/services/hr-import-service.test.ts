import { beforeEach, describe, expect, it } from "vitest";
import {
  createHrImportService,
  resetHrImportMemoryForTests,
} from "@/application/services/hr-import-service";
import { buildFilledOfficialWorkbook } from "@/domain/rules/hr-import/official-workbook-fixture";
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
import {
  mockDocumentStorage,
  resetMockStorageForTests,
} from "@/infrastructure/storage/mock-storage";
import { createHash } from "crypto";

const emails: { to: string; subject: string }[] = [];
const email = {
  async send(message: { to: string; subject: string; body: string }) {
    emails.push({ to: message.to, subject: message.subject });
    return { queued: true as const, provider: "mock-email" };
  },
};

describe("hr import service — official workbook", () => {
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

  it("downloads the canonical official template bytes", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const { buffer, fileName } = await svc().downloadTemplate(session);
    expect(fileName).toBe("ASTER_Modele_Import_RH_Maroc.xlsx");
    expect(createHash("sha256").update(buffer).digest("hex")).toBe(
      "bfd5b0bb7bf00b78c8589d290e39761c421fdad851fb56accb4e86ffa2a0fe6f",
    );
  });

  it("imports filled official workbook end-to-end via service path", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const bytes = await buildFilledOfficialWorkbook({
      employees: [
        [
          "emp-ma-10",
          "Amrani",
          "Nadia",
          "nadia.amrani@demo.aster-rh.local",
          "AUD",
          "Consultante",
          "Auditeur senior",
          "Youssef Alaoui",
          "Casablanca (démo)",
          "2024-02-01",
          "CDI",
          "Actif",
          "",
          "",
        ],
        [
          "emp-ma-11",
          "Saadi",
          "Karim",
          "",
          "AUD",
          "Assistant",
          "Auditeur junior",
          "",
          "Casablanca (démo)",
          "2023-06-01",
          "CDI",
          "Actif",
          "",
          "",
        ],
      ],
      balances: [
        [
          "emp-ma-11",
          "CP",
          "4",
          "Jours",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
        [
          "emp-ma-10",
          "RECUPERATION_HEURES",
          "7",
          "Heures",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
        [
          "emp-ma-10",
          "CP",
          "8",
          "Jours",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
      ],
    });

    const batch = await svc().uploadWorkbook(session, {
      fileName: "ASTER_Modele_Import_RH_Maroc.xlsx",
      bytes,
    });
    await svc().validateBatch(session, { batchId: batch.id });
    const preview = await svc().getBatch(session, batch.id);
    expect(preview?.employeeDrafts.length).toBe(2);
    expect(preview?.balanceDrafts.length).toBe(3);
    expect(preview?.employeeDrafts.every((d) => d.severity !== "error")).toBe(
      true,
    );
    expect(preview?.balanceDrafts.every((d) => d.severity !== "error")).toBe(
      true,
    );

    const done = await svc().confirmAndExecute(session, {
      batchId: batch.id,
      confirmationPhrase: "IMPORTER",
    });
    expect(done.status).toMatch(/^completed/);
    expect(done.employeesCreated).toBe(2);
    expect(done.accountsCreated).toBe(1);
    expect(done.accountsPending).toBe(1);
    expect(done.balancesImported).toBe(3);

    const nadia = await findAccountByEmployeeId("emp-ma-10");
    expect(nadia?.role).toBe("collaborateur");
    expect(nadia?.mustChangePassword).toBe(true);
    expect(await findAccountByEmployeeId("emp-ma-11")).toBeNull();

    const openings = (
      await demoHrRepository.listLeaveLedgerEntries({
        employeeId: "emp-ma-10",
        year: 2026,
      })
    ).filter((e) => e.sourceKind === HR_IMPORT_OPENING_SOURCE_KIND);
    expect(openings.some((e) => e.account === "recuperation" && e.unit === "hours")).toBe(
      true,
    );
    expect(openings.some((e) => Number(e.quantity) === 7)).toBe(true);

    await expect(
      svc().confirmAndExecute(session, {
        batchId: batch.id,
        confirmationPhrase: "IMPORTER",
      }),
    ).rejects.toThrow(/déjà exécuté/);

    const persisted = await getHrImportBatch(batch.id);
    expect(persisted?.executionReport?.balancesImported).toBe(3);
  });

  it("cancels an unexecuted batch without writing employees, accounts or ledger", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const bytes = await buildFilledOfficialWorkbook({
      employees: [
        [
          "emp-cancel-01",
          "Test",
          "Annule",
          "annule.e2e@demo.aster-rh.local",
          "AUD",
          "Consultante",
          "Auditeur senior",
          "",
          "Casablanca (démo)",
          "2024-02-01",
          "CDI",
          "Actif",
          "",
          "",
        ],
      ],
      balances: [
        [
          "emp-cancel-01",
          "CP",
          "3",
          "Jours",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
      ],
    });
    const uploaded = await svc().uploadWorkbook(session, {
      fileName: "to-cancel.xlsx",
      bytes,
    });
    const validated = await svc().validateBatch(session, {
      batchId: uploaded.id,
    });
    expect(validated.status).toBe("awaiting_confirmation");

    const employeesBefore = (await demoHrRepository.listEmployees()).length;
    const ledgerBefore = (
      await demoHrRepository.listLeaveLedgerEntries({ year: 2026 })
    ).length;

    const cancelled = await svc().cancelBatch(session, validated.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.storageKey).toBeNull();
    expect(cancelled.employeeDrafts).toEqual([]);
    expect(cancelled.balanceDrafts).toEqual([]);

    const again = await svc().cancelBatch(session, validated.id);
    expect(again.status).toBe("cancelled");

    await expect(
      svc().confirmAndExecute(session, {
        batchId: validated.id,
        confirmationPhrase: "IMPORTER",
      }),
    ).rejects.toThrow(/abandonné|refusée/);

    expect((await demoHrRepository.listEmployees()).length).toBe(
      employeesBefore,
    );
    expect(
      (await demoHrRepository.listLeaveLedgerEntries({ year: 2026 })).length,
    ).toBe(ledgerBefore);
    expect(await findAccountByEmployeeId("emp-cancel-01")).toBeNull();

    const listed = await svc().listBatches(session);
    expect(listed.some((b) => b.id === validated.id && b.status === "cancelled")).toBe(
      true,
    );
  });

  it("refuses cancel for chef / collaborateur and for completed or executing lots", async () => {
    const rh = testSessionFor("emp-camille", "admin_rh");
    const bytes = await buildFilledOfficialWorkbook({
      employees: [
        [
          "emp-cancel-02",
          "Chef",
          "Block",
          "chef.block@demo.aster-rh.local",
          "AUD",
          "Consultante",
          "Auditeur senior",
          "",
          "Casablanca (démo)",
          "2024-02-01",
          "CDI",
          "Actif",
          "",
          "",
        ],
      ],
      balances: [],
    });
    const batch = await svc().uploadWorkbook(rh, {
      fileName: "perm.xlsx",
      bytes,
    });
    await svc().validateBatch(rh, { batchId: batch.id });

    await expect(
      svc().cancelBatch(testSessionFor("emp-julien", "chef_de_projet"), batch.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      svc().cancelBatch(testSessionFor("emp-lea", "collaborateur"), batch.id),
    ).rejects.toMatchObject({ status: 403 });

    const doneBytes = await buildFilledOfficialWorkbook({
      employees: [
        [
          "emp-cancel-03",
          "Done",
          "Batch",
          "done.batch@demo.aster-rh.local",
          "AUD",
          "Consultante",
          "Auditeur senior",
          "",
          "Casablanca (démo)",
          "2024-02-01",
          "CDI",
          "Actif",
          "",
          "",
        ],
      ],
      balances: [
        [
          "emp-cancel-03",
          "CP",
          "1",
          "Jours",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
      ],
    });
    const doneUpload = await svc().uploadWorkbook(rh, {
      fileName: "done.xlsx",
      bytes: doneBytes,
    });
    await svc().validateBatch(rh, { batchId: doneUpload.id });
    await svc().confirmAndExecute(rh, {
      batchId: doneUpload.id,
      confirmationPhrase: "IMPORTER",
    });
    await expect(svc().cancelBatch(rh, doneUpload.id)).rejects.toThrow(
      /déjà exécuté/,
    );

    const executingId = (
      await svc().uploadWorkbook(rh, { fileName: "exec.xlsx", bytes })
    ).id;
    await svc().validateBatch(rh, { batchId: executingId });
    const { saveHrImportBatch, getHrImportBatch } = await import(
      "@/infrastructure/persistence/hr-import-batch-store"
    );
    const current = await getHrImportBatch(executingId);
    await saveHrImportBatch({ ...current!, status: "executing" });
    await expect(svc().cancelBatch(rh, executingId)).rejects.toThrow(
      /en cours d'exécution/,
    );
  });

  it("keeps invalid batches in validated (no IMPORTER) and blocks confirm", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    const bytes = await buildFilledOfficialWorkbook({
      employees: [
        [
          "",
          "X",
          "Y",
          "bad-email",
          "UNKNOWN_DEPT",
          "Poste",
          "Site",
          "not-a-date",
          "XXX",
          "Nope",
          "",
          "",
          "",
        ],
      ],
      balances: [
        ["missing-emp", "CP", "-1", "Jours", "bad", "", "", "", ""],
      ],
    });
    const batch = await svc().uploadWorkbook(session, {
      fileName: "bad.xlsx",
      bytes,
    });
    const validated = await svc().validateBatch(session, { batchId: batch.id });
    expect(validated.status).toBe("validated");
    expect(validated.errorMessage).toMatch(/lignes invalides/i);
    expect(
      validated.employeeDrafts.some((d) => d.severity === "error") ||
        validated.balanceDrafts.some((d) => d.severity === "error"),
    ).toBe(true);

    await expect(
      svc().confirmAndExecute(session, {
        batchId: batch.id,
        confirmationPhrase: "IMPORTER",
      }),
    ).rejects.toThrow(/lignes invalides/);
  });

  it("refuses collaborateur and blocks chef execution", async () => {
    await expect(
      svc().uploadWorkbook(testSessionFor("emp-lea", "collaborateur"), {
        fileName: "x.xlsx",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      svc().uploadWorkbook(testSessionFor("emp-julien", "chef_de_projet"), {
        fileName: "x.xlsx",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
