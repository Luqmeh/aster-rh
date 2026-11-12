import { beforeEach, describe, expect, it } from "vitest";
import { createDocumentRequestService } from "@/application/services/document-request-service";
import { createLeaveService } from "@/application/services/leave-service";
import { createTeleworkService } from "@/application/services/telework-service";
import { createWorkAbsenceService } from "@/application/services/work-absence-service";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";

const email = {
  async send() {
    return { queued: true as const, provider: "mock-email" };
  },
};

const memoryStorage: DocumentStoragePort = {
  async putObject(key, data, contentType) {
    return { key, contentType, sizeBytes: data.byteLength };
  },
  async getDownloadUrl(key) {
    return `https://signed.example/${encodeURIComponent(key)}`;
  },
};

describe("management accounts — no employee self-service", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("refuse leave submit for Senior Manager and RH, allows collaborateur", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const payload = {
      type: "conges_payes" as const,
      startDate: "2026-12-01",
      endDate: "2026-12-01",
      halfDayStart: false,
      halfDayEnd: false,
    };

    await expect(
      leave.submit(testSessionFor("emp-julien", "chef_de_projet"), payload),
    ).rejects.toThrow(/libre-service congés/i);
    await expect(
      leave.submit(testSessionFor("emp-camille", "admin_rh"), payload),
    ).rejects.toThrow(/libre-service congés/i);

    const created = await leave.submit(
      testSessionFor("emp-lea", "collaborateur"),
      payload,
    );
    expect(created.status).toBe("en_attente_manager");
  });

  it("refuse telework submit for management, allows collaborateur", async () => {
    const telework = createTeleworkService({ hr: demoHrRepository, email });
    const payload = {
      month: "2027-03",
      days: ["2027-03-02", "2027-03-03"],
      reason: "Test",
    };

    await expect(
      telework.submitMonthlyPlan(
        testSessionFor("emp-julien", "chef_de_projet"),
        payload,
      ),
    ).rejects.toThrow(/libre-service télétravail/i);
    await expect(
      telework.submitMonthlyPlan(
        testSessionFor("emp-camille", "admin_rh"),
        payload,
      ),
    ).rejects.toThrow(/libre-service télétravail/i);

    const created = await telework.submitMonthlyPlan(
      testSessionFor("emp-lea", "collaborateur"),
      payload,
    );
    expect(created.status).toBe("en_attente_manager");
  });

  it("refuse document request create for management", async () => {
    const docs = createDocumentRequestService({
      hr: demoHrRepository,
      email,
      storage: memoryStorage,
    });

    await expect(
      docs.create(testSessionFor("emp-julien", "chef_de_projet"), {
        documentType: "attestation_travail",
        reason: "Besoin personnel",
      }),
    ).rejects.toThrow(/refus/i);
    await expect(
      docs.create(testSessionFor("emp-camille", "admin_rh"), {
        documentType: "attestation_travail",
        reason: "Besoin personnel",
      }),
    ).rejects.toThrow(/refus/i);

    const created = await docs.create(
      testSessionFor("emp-lea", "collaborateur"),
      {
        documentType: "attestation_travail",
        reason: "Besoin collaborateur",
      },
    );
    expect(created.status).toBe("en_attente");
  });

  it("refuse work absence declare for management, allows collaborateur", async () => {
    const absences = createWorkAbsenceService({
      hr: demoHrRepository,
      email,
      storage: memoryStorage,
    });
    const payload = {
      category: "arret_maladie" as const,
      startDate: "2026-12-03",
      endDate: "2026-12-03",
      comment: "Test absence",
    };

    await expect(
      absences.declare(
        testSessionFor("emp-julien", "chef_de_projet"),
        payload,
      ),
    ).rejects.toThrow(/refus/i);
    await expect(
      absences.declare(testSessionFor("emp-camille", "admin_rh"), payload),
    ).rejects.toThrow(/refus/i);

    const created = await absences.declare(
      testSessionFor("emp-lea", "collaborateur"),
      payload,
    );
    expect(created.id).toBeTruthy();
  });

  it("Senior Manager can still approve collaborateur leave", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const created = await leave.submit(
      testSessionFor("emp-lea", "collaborateur"),
      {
        type: "conges_payes",
        startDate: "2026-12-04",
        endDate: "2026-12-04",
        halfDayStart: false,
        halfDayEnd: false,
      },
    );
    const decided = await leave.decide(
      testSessionFor("emp-julien", "chef_de_projet"),
      created.id,
      "approuvee",
    );
    expect(decided.status).toBe("approuvee");
  });

  it("RH cannot approve leave", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const created = await leave.submit(
      testSessionFor("emp-lea", "collaborateur"),
      {
        type: "conges_payes",
        startDate: "2026-12-07",
        endDate: "2026-12-07",
        halfDayStart: false,
        halfDayEnd: false,
      },
    );
    await expect(
      leave.decide(
        testSessionFor("emp-camille", "admin_rh"),
        created.id,
        "approuvee",
      ),
    ).rejects.toThrow(/ressources humaines|ne peuvent pas les approuver/i);
  });
});
