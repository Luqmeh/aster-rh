import { describe, expect, it, vi } from "vitest";
import {
  parseAndValidateLeaveForm,
  resetLeaveFormElement,
  resolveLeaveSubmissionUi,
  shouldBlockLeaveSubmit,
} from "@/components/modules/leave-form-logic";

/**
 * Simule le handler de soumission (sans React), en capturant le formulaire
 * avant l'await — comme le correctif de LeaveForm.
 */
async function simulateLeaveSubmit(options: {
  formData: FormData;
  pending: boolean;
  submit: () => Promise<{ ok: true; id: string }>;
  formElement: HTMLFormElement | null;
}) {
  if (shouldBlockLeaveSubmit(options.pending)) {
    return {
      blocked: true as const,
      feedback: { success: null as string | null, error: null as string | null },
      resetCalled: false,
    };
  }

  const validated = parseAndValidateLeaveForm(options.formData);
  if (!validated.ok) {
    const ui = resolveLeaveSubmissionUi({
      kind: "validation",
      message: validated.message,
    });
    return {
      blocked: false as const,
      feedback: ui.feedback,
      resetCalled: false,
    };
  }

  // Référence capturée avant l'async (évite event.currentTarget === null).
  const formElement = options.formElement;

  try {
    const result = await options.submit();
    if (!result?.ok || !result.id) {
      const ui = resolveLeaveSubmissionUi({
        kind: "failure",
        error: new Error("La demande n'a pas pu être enregistrée."),
      });
      return {
        blocked: false as const,
        feedback: ui.feedback,
        resetCalled: false,
      };
    }

    const ui = resolveLeaveSubmissionUi({
      kind: "success",
      requestId: result.id,
    });

    let resetCalled = false;
    if (ui.shouldReset) {
      if (formElement) {
        const originalReset = formElement.reset.bind(formElement);
        formElement.reset = () => {
          resetCalled = true;
          originalReset();
        };
      }
      resetLeaveFormElement(formElement);
    }

    return {
      blocked: false as const,
      feedback: ui.feedback,
      resetCalled,
    };
  } catch (error) {
    const ui = resolveLeaveSubmissionUi({ kind: "failure", error });
    return {
      blocked: false as const,
      feedback: ui.feedback,
      resetCalled: false,
    };
  }
}

describe("leave submission flow", () => {
  it("succès : message de succès unique, reset du formulaire, pas d'erreur", async () => {
    const reset = vi.fn();
    const formElement = { reset } as unknown as HTMLFormElement;
    const formData = new FormData();
    formData.set("type", "rtt");
    formData.set("startDate", "2026-11-18");
    formData.set("endDate", "2026-11-18");

    const outcome = await simulateLeaveSubmit({
      formData,
      pending: false,
      formElement,
      submit: async () => ({ ok: true, id: "leave-42" }),
    });

    expect(outcome.blocked).toBe(false);
    expect(outcome.feedback.success).toBe("Demande enregistrée (leave-42).");
    expect(outcome.feedback.error).toBeNull();
    expect(outcome.resetCalled).toBe(true);
  });

  it("échec serveur : message d'erreur unique, pas de succès, pas de reset", async () => {
    const reset = vi.fn();
    const formElement = { reset } as unknown as HTMLFormElement;
    const formData = new FormData();
    formData.set("type", "conges_payes");
    formData.set("startDate", "2026-11-18");
    formData.set("endDate", "2026-11-20");

    const outcome = await simulateLeaveSubmit({
      formData,
      pending: false,
      formElement,
      submit: async () => {
        throw new Error(
          "Solde insuffisant : 2 jour(s) disponible(s), 3 demandé(s).",
        );
      },
    });

    expect(outcome.feedback.success).toBeNull();
    expect(outcome.feedback.error).toMatch(/Solde insuffisant/);
    expect(outcome.resetCalled).toBe(false);
    expect(reset).not.toHaveBeenCalled();
  });

  it("empêche les soumissions en double pendant pending", async () => {
    const submit = vi.fn(async () => ({ ok: true as const, id: "x" }));
    const formData = new FormData();
    formData.set("type", "rtt");
    formData.set("startDate", "2026-11-18");
    formData.set("endDate", "2026-11-18");

    const outcome = await simulateLeaveSubmit({
      formData,
      pending: true,
      formElement: null,
      submit,
    });

    expect(outcome.blocked).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    expect(outcome.feedback.success).toBeNull();
    expect(outcome.feedback.error).toBeNull();
  });

  it("ne combine pas succès et erreur quand currentTarget serait null après await", async () => {
    const formData = new FormData();
    formData.set("type", "rtt");
    formData.set("startDate", "2026-11-18");
    formData.set("endDate", "2026-11-18");

    // Reproduction de l'ancien bug : reset sur null après await.
    const currentTargetAfterAwait: { reset: () => void } | null = null;
    expect(() => currentTargetAfterAwait!.reset()).toThrow();

    const outcome = await simulateLeaveSubmit({
      formData,
      pending: false,
      formElement: { reset: vi.fn() } as unknown as HTMLFormElement,
      submit: async () => ({ ok: true, id: "leave-ok" }),
    });

    expect(outcome.feedback.success).toBe("Demande enregistrée (leave-ok).");
    expect(outcome.feedback.error).toBeNull();
    expect(outcome.resetCalled).toBe(true);
  });
});
