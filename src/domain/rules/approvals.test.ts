import { describe, expect, it } from "vitest";
import {
  assertCanDecideRequest,
  canApproveAsManager,
  decisionNotificationCopy,
  initialStatusAfterSubmit,
  isTerminalRequestStatus,
  nextStatusAfterManagerDecision,
} from "@/domain/rules/approvals";
import type { Employee } from "@/domain/types/hr";

const manager: Employee = {
  id: "mgr",
  demoIdentityId: "x",
  firstName: "A",
  lastName: "B",
  email: "a@demo.local",
  jobTitle: "Manager",
  departmentId: "d",
  managerId: null,
  site: "Paris",
  contractType: "cdi",
  category: "cadre",
  hireDate: "2020-01-01",
  isActive: true,
  teleworkEligible: true,
  phoneInternal: null,
  avatarInitials: "AB",
  teleworkDaysPerWeek: 2,
};

const report: Employee = {
  ...manager,
  id: "emp",
  managerId: "mgr",
  firstName: "C",
  lastName: "D",
  email: "c@demo.local",
  avatarInitials: "CD",
};

describe("approvals", () => {
  it("place une demande soumise en attente manager", () => {
    expect(initialStatusAfterSubmit()).toBe("en_attente_manager");
  });

  it("autorise le manager de l'employé", () => {
    expect(
      canApproveAsManager(manager, report, "en_attente_manager"),
    ).toBe(true);
  });

  it("refuse un manager non concerné", () => {
    expect(
      canApproveAsManager(
        { ...manager, id: "other" },
        report,
        "en_attente_manager",
      ),
    ).toBe(false);
  });

  it("refuse si déjà traitée", () => {
    expect(canApproveAsManager(manager, report, "approuvee")).toBe(false);
  });

  it("calcule le statut après décision", () => {
    expect(nextStatusAfterManagerDecision("approuvee", false)).toBe(
      "approuvee",
    );
    expect(nextStatusAfterManagerDecision("approuvee", true)).toBe(
      "en_attente_rh",
    );
    expect(nextStatusAfterManagerDecision("refusee", false)).toBe("refusee");
  });

  it("détecte les statuts terminaux", () => {
    expect(isTerminalRequestStatus("approuvee")).toBe(true);
    expect(isTerminalRequestStatus("refusee")).toBe(true);
    expect(isTerminalRequestStatus("en_attente_manager")).toBe(false);
  });
});

describe("assertCanDecideRequest", () => {
  it("autorise le manager sur une demande en attente", () => {
    const result = assertCanDecideRequest({
      role: "manager",
      actor: manager,
      subject: report,
      status: "en_attente_manager",
    });
    expect(result).toEqual({ ok: true, mode: "manager" });
  });

  it("bloque le rôle collaborateur", () => {
    const result = assertCanDecideRequest({
      role: "collaborateur",
      actor: report,
      subject: report,
      status: "en_attente_manager",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/réservée au manager/i);
    }
  });

  it("bloque une demande déjà traitée avec un message dédié", () => {
    const result = assertCanDecideRequest({
      role: "manager",
      actor: manager,
      subject: report,
      status: "approuvee",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/déjà été traitée/i);
    }
  });

  it("autorise l'admin RH sur la file manager", () => {
    const result = assertCanDecideRequest({
      role: "admin_rh",
      actor: { ...manager, id: "admin" },
      subject: report,
      status: "en_attente_manager",
    });
    expect(result).toEqual({ ok: true, mode: "admin_rh" });
  });

  it("refuse un manager hors périmètre", () => {
    const result = assertCanDecideRequest({
      role: "manager",
      actor: { ...manager, id: "other" },
      subject: report,
      status: "en_attente_manager",
    });
    expect(result.ok).toBe(false);
  });
});

describe("decisionNotificationCopy", () => {
  it("produit des titres cohérents avec la décision", () => {
    expect(decisionNotificationCopy("leave", "approuvee").title).toMatch(
      /approuvée/i,
    );
    expect(decisionNotificationCopy("leave", "refusee").title).toMatch(
      /refusée/i,
    );
    expect(decisionNotificationCopy("telework", "approuvee").title).toMatch(
      /approuvé/i,
    );
  });
});
