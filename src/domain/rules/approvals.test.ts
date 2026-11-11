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

const chef: Employee = {
  id: "mgr",
  demoIdentityId: "x",
  firstName: "A",
  lastName: "B",
  email: "a@demo.local",
  jobTitle: "Chef de projet",
  departmentId: "d",
  managerId: null,
  site: "Casablanca (démo)",
  contractType: "cdi",
  category: "cadre",
  hireDate: "2020-01-01",
  isActive: true,
  employmentStatus: "actif",
  departureDate: null,
  departureNote: null,
  teleworkEligible: true,
  phoneInternal: null,
  avatarInitials: "AB",
  teleworkDaysPerWeek: 2,
    standardDailyHours: 7,
    isPartTime: false,
    weeklyContractHours: 44,
    workingTimePercent: 100,
    officeCalendarId: null,
    policyGroup: "standard_ma",
    birthDate: "1990-01-15",
    activitySector: "non_agricole",
};

const report: Employee = {
  ...chef,
  id: "emp",
  managerId: "mgr",
  firstName: "C",
  lastName: "D",
  email: "c@demo.local",
  avatarInitials: "CD",
};

describe("approvals", () => {
  it("place une demande soumise en attente de validation", () => {
    expect(initialStatusAfterSubmit()).toBe("en_attente_manager");
  });

  it("conserve canApproveAsManager pour le rattachement hiérarchique", () => {
    expect(canApproveAsManager(chef, report, "en_attente_manager")).toBe(true);
  });

  it("refuse un rattachement non concerné", () => {
    expect(
      canApproveAsManager(
        { ...chef, id: "other" },
        report,
        "en_attente_manager",
      ),
    ).toBe(false);
  });

  it("refuse si déjà traitée", () => {
    expect(canApproveAsManager(chef, report, "approuvee")).toBe(false);
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
  it("autorise le Chef de projet sur une demande en attente (portée globale)", () => {
    const result = assertCanDecideRequest({
      role: "chef_de_projet",
      actor: chef,
      subject: report,
      status: "en_attente_manager",
    });
    expect(result).toEqual({ ok: true, mode: "chef_de_projet" });
  });

  it("autorise le Chef de projet hors rattachement hiérarchique", () => {
    const result = assertCanDecideRequest({
      role: "chef_de_projet",
      actor: { ...chef, id: "other" },
      subject: report,
      status: "en_attente_manager",
    });
    expect(result).toEqual({ ok: true, mode: "chef_de_projet" });
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
      expect(result.message).toMatch(/Chef de projet/i);
    }
  });

  it("bloque une demande déjà traitée avec un message dédié", () => {
    const result = assertCanDecideRequest({
      role: "chef_de_projet",
      actor: chef,
      subject: report,
      status: "approuvee",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/déjà été traitée/i);
    }
  });

  it("refuse à l'admin RH toute décision (séparation des rôles)", () => {
    const pending = assertCanDecideRequest({
      role: "admin_rh",
      actor: { ...chef, id: "admin" },
      subject: report,
      status: "en_attente_manager",
    });
    expect(pending.ok).toBe(false);

    const hrQueue = assertCanDecideRequest({
      role: "admin_rh",
      actor: { ...chef, id: "admin" },
      subject: report,
      status: "en_attente_rh",
    });
    expect(hrQueue.ok).toBe(false);
    if (!hrQueue.ok) {
      expect(hrQueue.message).toMatch(/ressources humaines/i);
    }
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
