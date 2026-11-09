import { beforeEach, describe, expect, it } from "vitest";
import { createDocumentRequestService } from "@/application/services/document-request-service";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { mockDocumentStorage } from "@/infrastructure/storage/mock-storage";
import { mockEmail } from "@/infrastructure/email/mock-email";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { Employee } from "@/domain/types/hr";

function sessionFor(
  employee: Employee,
  role: AuthSession["role"],
): AuthSession {
  return {
    userId: `acc-${employee.id}`,
    email: employee.email,
    employee,
    role,
    authProvider: "credentials",
    isDemoMode: true,
  };
}

describe("document-request-service", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  async function loadEmployee(id: string) {
    const emp = await demoHrRepository.getEmployee(id);
    if (!emp) throw new Error("missing");
    return emp;
  }

  it("permet au collaborateur de créer une demande pour lui-même", async () => {
    const service = createDocumentRequestService({
      hr: demoHrRepository,
      email: mockEmail,
      storage: mockDocumentStorage,
    });
    const lea = await loadEmployee("emp-lea");
    const created = await service.create(sessionFor(lea, "collaborateur"), {
      documentType: "attestation_travail",
      reason: "Dossier bancaire personnel",
    });
    expect(created.employeeId).toBe("emp-lea");
    expect(created.status).toBe("en_attente");
    expect(created.published).toBe(false);
  });

  it("refuse la création pour un autre collaborateur", async () => {
    const service = createDocumentRequestService({
      hr: demoHrRepository,
      email: mockEmail,
      storage: mockDocumentStorage,
    });
    const lea = await loadEmployee("emp-lea");
    await expect(
      service.create(sessionFor(lea, "collaborateur"), {
        documentType: "attestation_travail",
        reason: "Tentative pour autrui",
        employeeId: "emp-julien",
      }),
    ).rejects.toThrow(/propre compte/i);
  });

  it("empêche de voir les demandes d'un autre collaborateur", async () => {
    const service = createDocumentRequestService({
      hr: demoHrRepository,
      email: mockEmail,
      storage: mockDocumentStorage,
    });
    const lea = await loadEmployee("emp-lea");
    const julien = await loadEmployee("emp-julien");
    const created = await service.create(sessionFor(lea, "collaborateur"), {
      documentType: "attestation_employeur",
      reason: "Mutuelle famille",
    });
    await expect(
      service.getVisible(sessionFor(julien, "collaborateur"), created.id),
    ).rejects.toThrow(/refusé/i);
  });

  it("autorise RH et Chef à traiter ; refuse la publication au collaborateur", async () => {
    const service = createDocumentRequestService({
      hr: demoHrRepository,
      email: mockEmail,
      storage: mockDocumentStorage,
    });
    const lea = await loadEmployee("emp-lea");
    const camille = await loadEmployee("emp-camille");
    const julien = await loadEmployee("emp-julien");
    const created = await service.create(sessionFor(lea, "collaborateur"), {
      documentType: "copie_contrat",
      reason: "Dossier location",
    });

    const hrList = await service.listForHr(
      sessionFor(camille, "admin_rh"),
      {},
    );
    expect(hrList.some((r) => r.id === created.id)).toBe(true);

    const chefList = await service.listForHr(
      sessionFor(julien, "chef_de_projet"),
      {},
    );
    expect(chefList.some((r) => r.id === created.id)).toBe(true);

    await service.markProcessing(sessionFor(camille, "admin_rh"), created.id);
    await service.uploadDocument(
      sessionFor(camille, "admin_rh"),
      created.id,
      {
        fileName: "contrat.pdf",
        contentType: "application/pdf",
        bytes: new Uint8Array([1, 2, 3, 4]),
      },
    );

    const afterUpload = await demoHrRepository.getDocumentRequest(created.id);
    expect(afterUpload?.storageKey).toBeTruthy();
    expect(afterUpload?.published).toBe(false);

    await expect(
      service.getDownloadUrl(sessionFor(lea, "collaborateur"), created.id),
    ).rejects.toThrow(/pas encore mis à disposition/i);

    await expect(
      service.publish(sessionFor(lea, "collaborateur"), created.id),
    ).rejects.toThrow(/Publication réservée/i);

    await service.publish(sessionFor(camille, "admin_rh"), created.id);
    const url = await service.getDownloadUrl(
      sessionFor(lea, "collaborateur"),
      created.id,
    );
    expect(typeof url).toBe("string");

    await expect(
      service.getDownloadUrl(sessionFor(julien, "collaborateur"), created.id),
    ).rejects.toThrow();
  });

  it("Chef peut publier ; chemins recruitment refusés", async () => {
    const service = createDocumentRequestService({
      hr: demoHrRepository,
      email: mockEmail,
      storage: mockDocumentStorage,
    });
    const lea = await loadEmployee("emp-lea");
    const julien = await loadEmployee("emp-julien");
    const created = await service.create(sessionFor(lea, "collaborateur"), {
      documentType: "attestation_formation",
      reason: "Dossier formation continue",
    });
    await service.uploadDocument(
      sessionFor(julien, "chef_de_projet"),
      created.id,
      {
        fileName: "attestation.pdf",
        contentType: "application/pdf",
        bytes: new Uint8Array([9, 9]),
      },
    );
    // simule une clé compromise
    await demoHrRepository.updateDocumentRequest(created.id, {
      storageKey: "recruitment/cand-x/cv.pdf",
    });
    await expect(
      service.publish(sessionFor(julien, "chef_de_projet"), created.id),
    ).rejects.toThrow(/accès refusé|invalide|incohérente/i);
  });

  it("crée des notifications sans doublon immédiat", async () => {
    const service = createDocumentRequestService({
      hr: demoHrRepository,
      email: mockEmail,
      storage: mockDocumentStorage,
    });
    const lea = await loadEmployee("emp-lea");
    const camille = await loadEmployee("emp-camille");
    const created = await service.create(sessionFor(lea, "collaborateur"), {
      documentType: "attestation_remuneration",
      reason: "Prêt immobilier",
    });
    const before = await demoHrRepository.listNotifications("emp-lea");
    const countBefore = before.filter((n) =>
      n.title.includes("Demande documentaire"),
    ).length;

    await service.requestClarification(
      sessionFor(camille, "admin_rh"),
      created.id,
      "Merci de préciser la période concernée.",
    );
    await service.requestClarification(
      sessionFor(camille, "admin_rh"),
      created.id,
      "Merci de préciser la période concernée.",
    );

    const after = await demoHrRepository.listNotifications("emp-lea");
    const clarifs = after.filter((n) =>
      n.title.includes("Informations demandées"),
    );
    expect(clarifs.length).toBe(1);
    expect(countBefore).toBeGreaterThanOrEqual(1);
  });
});
