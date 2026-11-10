import { beforeEach, describe, expect, it } from "vitest";
import { createRecruitmentService } from "@/application/services/recruitment-service";
import { AuthError } from "@/infrastructure/auth/authorization";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import {
  mockDocumentStorage,
  resetMockStorageForTests,
} from "@/infrastructure/storage/mock-storage";

const email = {
  async send() {
    return { queued: true as const, provider: "mock-email" };
  },
};

describe("recruitment workflow", () => {
  beforeEach(() => {
    resetDemoStore();
    resetMockStorageForTests();
  });

  it("enchaîne création → CV → soumission → approbation → Appliquer", async () => {
    const service = createRecruitmentService({
      hr: demoHrRepository,
      email,
      storage: mockDocumentStorage,
    });
    const hr = testSessionFor("emp-camille", "admin_rh");
    const chef = testSessionFor("emp-julien", "chef_de_projet");

    const draft = await service.createDraft(hr, {
      fullName: "Alice Martin",
      email: "alice.martin@candidat.example",
      phone: "0600000000",
      positionTitle: "Auditrice junior",
      departmentId: "dept-audit",
      hrNotes: "Premier entretien RH positif.",
    });
    expect(draft.status).toBe("brouillon");

    await service.uploadCv(hr, draft.id, {
      fileName: "cv-alice.pdf",
      contentType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    const submitted = await service.submit(hr, draft.id);
    expect(submitted.status).toBe("soumis_revue");

    await expect(
      service.decide(hr, draft.id, "approuve"),
    ).rejects.toThrow(AuthError);

    const approved = await service.decide(chef, draft.id, "approuve", "OK profil");
    expect(approved.status).toBe("approuve");

    const assigned = await service.assignInterviewer(
      chef,
      draft.id,
      "emp-lea",
    );
    expect(assigned.status).toBe("intervieweur_assigne");
    expect(assigned.interviewerEmployeeId).toBe("emp-lea");

    const lea = testSessionFor("emp-lea", "collaborateur");
    const visible = await service.listVisible(lea);
    expect(visible.some((c) => c.id === draft.id)).toBe(true);

    const leaView = await service.get(lea, draft.id);
    expect(leaView.candidate.hrNotes).toBeNull();
    const hrView = await service.get(hr, draft.id);
    expect(hrView.candidate.hrNotes).toContain("Premier entretien");

    const marc = testSessionFor("emp-marc", "collaborateur");
    await expect(service.get(marc, draft.id)).rejects.toThrow(AuthError);
  });

  it("refuse le téléchargement CV si la clé Storage ne correspond pas au dossier", async () => {
    const service = createRecruitmentService({
      hr: demoHrRepository,
      email,
      storage: mockDocumentStorage,
    });
    const hr = testSessionFor("emp-camille", "admin_rh");
    const lea = testSessionFor("emp-lea", "collaborateur");
    const draft = await service.createDraft(hr, {
      fullName: "Eve",
      email: "eve@candidat.example",
      positionTitle: "Analyste",
      hrNotes: "Notes",
    });
    await service.uploadCv(hr, draft.id, {
      fileName: "cv.pdf",
      contentType: "application/pdf",
      bytes: new Uint8Array([1]),
    });
    // Manipulation hostile de la clé (autre candidat / path traversal).
    await demoHrRepository.updateRecruitmentCandidate(draft.id, {
      cvStorageKey: "recruitment/other-id/stolen.pdf",
    });
    await expect(service.getCvDownloadUrl(hr, draft.id)).rejects.toThrow(
      /incohérente|refusé/i,
    );
    await expect(service.getCvDownloadUrl(lea, draft.id)).rejects.toThrow(
      AuthError,
    );
  });

  it("refuse d'assigner un collaborateur inactif", async () => {
    const service = createRecruitmentService({
      hr: demoHrRepository,
      email,
      storage: mockDocumentStorage,
    });
    const hr = testSessionFor("emp-camille", "admin_rh");
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    const draft = await service.createDraft(hr, {
      fullName: "Bob",
      email: "bob@candidat.example",
      positionTitle: "Consultant",
      hrNotes: "Notes",
    });
    await service.uploadCv(hr, draft.id, {
      fileName: "cv.pdf",
      contentType: "application/pdf",
      bytes: new Uint8Array([9]),
    });
    await service.submit(hr, draft.id);
    await service.decide(chef, draft.id, "approuve");
    await demoHrRepository.updateEmployee("emp-marc", {
      employmentStatus: "inactif",
      isActive: false,
    });
    await expect(
      service.assignInterviewer(chef, draft.id, "emp-marc"),
    ).rejects.toThrow(/actif/i);
  });
});
