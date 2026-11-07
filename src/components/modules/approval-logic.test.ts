import { describe, expect, it } from "vitest";
import {
  approvalButtonLabel,
  approvalSuccessMessage,
  emptyApprovalFeedback,
  resolveApprovalUi,
  shouldBlockApprovalAction,
} from "@/components/modules/approval-logic";

describe("approval-logic", () => {
  it("produit un succès exclusif pour une approbation", () => {
    const feedback = resolveApprovalUi({
      kind: "success",
      decision: "approuvee",
    });
    expect(feedback.success).toBe("Demande approuvée.");
    expect(feedback.error).toBeNull();
  });

  it("produit un succès exclusif pour un refus", () => {
    const feedback = resolveApprovalUi({
      kind: "success",
      decision: "refusee",
    });
    expect(feedback.success).toBe("Demande refusée.");
    expect(feedback.error).toBeNull();
  });

  it("produit une erreur exclusive sans succès", () => {
    const feedback = resolveApprovalUi({
      kind: "failure",
      error: new Error("Cette demande a déjà été traitée."),
    });
    expect(feedback.success).toBeNull();
    expect(feedback.error).toMatch(/déjà été traitée/i);
  });

  it("n'affiche jamais succès et erreur simultanément", () => {
    const ok = resolveApprovalUi({ kind: "success", decision: "approuvee" });
    const ko = resolveApprovalUi({ kind: "failure", error: "x" });
    expect(Boolean(ok.success) && Boolean(ok.error)).toBe(false);
    expect(Boolean(ko.success) && Boolean(ko.error)).toBe(false);
  });

  it("bloque les actions pendant pending", () => {
    expect(shouldBlockApprovalAction(true)).toBe(true);
    expect(shouldBlockApprovalAction(false)).toBe(false);
  });

  it("affiche un libellé de chargement pour la décision en cours", () => {
    expect(approvalButtonLabel("approuvee", true, "approuvee")).toBe(
      "Approbation…",
    );
    expect(approvalButtonLabel("refusee", true, "refusee")).toBe("Refus…");
    expect(approvalButtonLabel("approuvee", false, null)).toBe("Approuver");
  });

  it("réinitialise le feedback", () => {
    expect(emptyApprovalFeedback()).toEqual({ success: null, error: null });
    expect(approvalSuccessMessage("approuvee")).toBe("Demande approuvée.");
  });
});
