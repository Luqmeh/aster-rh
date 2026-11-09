import { describe, expect, it } from "vitest";
import {
  assertDocumentStorageKeyOwnsRequest,
  buildEmployeeDocumentStorageKey,
  canTransitionDocumentRequest,
  isCnccAttestationEligible,
  isDepartureDocumentEligible,
  isDocumentTypeOfferedToEmployee,
  listOfferedDocumentTypes,
} from "@/domain/rules/document-requests";
import type { Employee } from "@/domain/types/hr";

function emp(partial: Partial<Employee>): Employee {
  return {
    id: "emp-1",
    demoIdentityId: "d",
    firstName: "A",
    lastName: "B",
    email: "a@b.c",
    jobTitle: "Collaborateur",
    departmentId: "dep",
    managerId: null,
    site: "Paris",
    contractType: "cdi",
    category: "cadre",
    hireDate: "2020-01-01",
    employmentStatus: "actif",
    departureDate: null,
    departureNote: null,
    isActive: true,
    phoneInternal: null,
    avatarInitials: "AB",
    teleworkEligible: true,
    teleworkDaysPerWeek: 2,
    standardDailyHours: 7,
    ...partial,
  };
}

describe("document-requests rules", () => {
  it("restreint les documents de départ aux collaborateurs partis / inactifs avec départ", () => {
    expect(isDepartureDocumentEligible("actif", null)).toBe(false);
    expect(isDepartureDocumentEligible("parti", "2026-01-01")).toBe(true);
    expect(isDepartureDocumentEligible("inactif", "2026-01-01")).toBe(true);
    expect(isDepartureDocumentEligible("inactif", null)).toBe(false);

    const active = emp({ employmentStatus: "actif" });
    expect(
      isDocumentTypeOfferedToEmployee("certificat_travail", active),
    ).toBe(false);
    const departed = emp({
      employmentStatus: "parti",
      departureDate: "2026-01-01",
      isActive: false,
    });
    expect(
      isDocumentTypeOfferedToEmployee("certificat_travail", departed),
    ).toBe(true);
  });

  it("limite l'attestation CNCC aux intitulés CAC / commissaire (hypothèse démo)", () => {
    expect(isCnccAttestationEligible(emp({ jobTitle: "Assistante" }))).toBe(
      false,
    );
    expect(
      isCnccAttestationEligible(emp({ jobTitle: "Senior Audit CAC" })),
    ).toBe(true);
    const types = listOfferedDocumentTypes(
      emp({ jobTitle: "Senior Audit CAC" }),
    );
    expect(types).toContain("attestation_cncc");
  });

  it("isole le namespace employee-documents du recrutement", () => {
    const key = buildEmployeeDocumentStorageKey("emp-1", "req-1", "att.pdf");
    expect(key.startsWith("employee-documents/emp-1/req-1/")).toBe(true);
    expect(assertDocumentStorageKeyOwnsRequest(key, "emp-1", "req-1").ok).toBe(
      true,
    );
    expect(
      assertDocumentStorageKeyOwnsRequest(
        "recruitment/cand-1/cv.pdf",
        "emp-1",
        "req-1",
      ).ok,
    ).toBe(false);
    expect(
      assertDocumentStorageKeyOwnsRequest(key, "emp-2", "req-1").ok,
    ).toBe(false);
  });

  it("valide les transitions de statut", () => {
    expect(canTransitionDocumentRequest("en_attente", "en_traitement")).toBe(
      true,
    );
    expect(
      canTransitionDocumentRequest("en_traitement", "document_disponible"),
    ).toBe(true);
    expect(canTransitionDocumentRequest("refusee", "en_traitement")).toBe(
      false,
    );
  });
});
