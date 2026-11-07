import { describe, expect, it, vi } from "vitest";
import {
  emptyLeaveFeedback,
  errorLeaveFeedback,
  parseAndValidateLeaveForm,
  resetLeaveFormElement,
  resolveLeaveSubmissionUi,
  shouldBlockLeaveSubmit,
  successLeaveFeedback,
} from "@/components/modules/leave-form-logic";

function formDataFrom(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("parseAndValidateLeaveForm", () => {
  it("accepte une demande valide", () => {
    const result = parseAndValidateLeaveForm(
      formDataFrom({
        type: "rtt",
        startDate: "2026-11-10",
        endDate: "2026-11-10",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.type).toBe("rtt");
      expect(result.input.startDate).toBe("2026-11-10");
    }
  });

  it("rejette une plage de dates invalide", () => {
    const result = parseAndValidateLeaveForm(
      formDataFrom({
        type: "conges_payes",
        startDate: "2026-11-20",
        endDate: "2026-11-10",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/date de fin/i);
    }
  });

  it("rejette les dates manquantes", () => {
    const result = parseAndValidateLeaveForm(
      formDataFrom({
        type: "rtt",
        startDate: "",
        endDate: "",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/obligatoires/i);
    }
  });
});

describe("resolveLeaveSubmissionUi", () => {
  it("produit un seul message de succès et demande un reset", () => {
    const ui = resolveLeaveSubmissionUi({
      kind: "success",
      requestId: "leave-abc",
    });
    expect(ui.feedback.success).toBe("Demande enregistrée (leave-abc).");
    expect(ui.feedback.error).toBeNull();
    expect(ui.shouldReset).toBe(true);
  });

  it("produit un seul message d'erreur sans reset en cas d'échec", () => {
    const ui = resolveLeaveSubmissionUi({
      kind: "failure",
      error: new Error("Solde insuffisant"),
    });
    expect(ui.feedback.success).toBeNull();
    expect(ui.feedback.error).toBe("Solde insuffisant");
    expect(ui.shouldReset).toBe(false);
  });

  it("n'affiche jamais succès et erreur simultanément", () => {
    const success = successLeaveFeedback("id-1");
    const failure = errorLeaveFeedback("boom");
    expect(success.success && success.error).toBeFalsy();
    expect(failure.success && failure.error).toBeFalsy();
    expect(success.error).toBeNull();
    expect(failure.success).toBeNull();
  });

  it("ne réinitialise pas le formulaire après une erreur de validation", () => {
    const ui = resolveLeaveSubmissionUi({
      kind: "validation",
      message: "Dates invalides",
    });
    expect(ui.shouldReset).toBe(false);
    expect(ui.feedback.error).toBe("Dates invalides");
    expect(ui.feedback.success).toBeNull();
  });
});

describe("resetLeaveFormElement", () => {
  it("réinitialise le formulaire après un succès confirmé", () => {
    const reset = vi.fn();
    const form = { reset } as unknown as HTMLFormElement;
    const ui = resolveLeaveSubmissionUi({
      kind: "success",
      requestId: "leave-1",
    });
    expect(ui.shouldReset).toBe(true);
    resetLeaveFormElement(form);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("ne lève pas d'erreur si la référence du formulaire est nulle", () => {
    expect(() => resetLeaveFormElement(null)).not.toThrow();
    expect(() => resetLeaveFormElement(undefined)).not.toThrow();
  });
});

describe("shouldBlockLeaveSubmit", () => {
  it("bloque les soumissions pendant un envoi en cours", () => {
    expect(shouldBlockLeaveSubmit(true)).toBe(true);
    expect(shouldBlockLeaveSubmit(false)).toBe(false);
  });
});

describe("emptyLeaveFeedback", () => {
  it("efface succès et erreur", () => {
    expect(emptyLeaveFeedback()).toEqual({ success: null, error: null });
  });
});
