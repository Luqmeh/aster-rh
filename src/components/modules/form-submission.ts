/** Helpers partagés pour les formulaires de demande (congés, télétravail, …). */

export type FormFeedback = {
  success: string | null;
  error: string | null;
};

export function emptyFeedback(): FormFeedback {
  return { success: null, error: null };
}

export function successFeedback(requestId: string): FormFeedback {
  return {
    success: `Demande enregistrée (${requestId}).`,
    error: null,
  };
}

export function errorFeedback(message: string): FormFeedback {
  return {
    success: null,
    error: message,
  };
}

export function errorFromUnknown(err: unknown): string {
  return err instanceof Error ? err.message : "Erreur lors de la soumission.";
}

export type SubmissionOutcome =
  | { kind: "success"; requestId: string }
  | { kind: "failure"; error: unknown }
  | { kind: "validation"; message: string };

/**
 * Messages exclusifs + indication de reset (uniquement après succès confirmé).
 */
export function resolveSubmissionUi(
  outcome: SubmissionOutcome,
): { feedback: FormFeedback; shouldReset: boolean } {
  if (outcome.kind === "success") {
    return {
      feedback: successFeedback(outcome.requestId),
      shouldReset: true,
    };
  }
  if (outcome.kind === "validation") {
    return {
      feedback: errorFeedback(outcome.message),
      shouldReset: false,
    };
  }
  return {
    feedback: errorFeedback(errorFromUnknown(outcome.error)),
    shouldReset: false,
  };
}

/** Reset DOM sûr — ignore les références nulles (cycle de vie React). */
export function resetFormElement(form: HTMLFormElement | null | undefined) {
  form?.reset();
}

/** Empêche les soumissions concurrentes pendant une transition. */
export function shouldBlockSubmit(pending: boolean): boolean {
  return pending;
}
