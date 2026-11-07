import {
  emptyFeedback,
  errorFeedback,
  errorFromUnknown,
  resetFormElement,
  resolveSubmissionUi,
  shouldBlockSubmit,
  successFeedback,
  type FormFeedback,
  type SubmissionOutcome,
} from "@/components/modules/form-submission";
import {
  leaveRequestInputSchema,
  type LeaveRequestInput,
} from "@/domain/rules/leave";
import type { LeaveType } from "@/domain/types/hr";

export type LeaveFormFeedback = FormFeedback;

export const emptyLeaveFeedback = emptyFeedback;
export const successLeaveFeedback = successFeedback;
export const errorLeaveFeedback = errorFeedback;
export const leaveErrorFromUnknown = errorFromUnknown;
export const resetLeaveFormElement = resetFormElement;
export const shouldBlockLeaveSubmit = shouldBlockSubmit;

export function resolveLeaveSubmissionUi(outcome: SubmissionOutcome) {
  return resolveSubmissionUi(outcome);
}

/**
 * Valide les champs requis et la cohérence des dates avant l'appel serveur.
 * Ne persiste rien.
 */
export function parseAndValidateLeaveForm(
  formData: FormData,
): { ok: true; input: LeaveRequestInput } | { ok: false; message: string } {
  const type = String(formData.get("type") ?? "");
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  if (!type) {
    return { ok: false, message: "Le type de congé est obligatoire." };
  }
  if (!startDate || !endDate) {
    return {
      ok: false,
      message: "Les dates de début et de fin sont obligatoires.",
    };
  }

  const parsed = leaveRequestInputSchema.safeParse({
    type: type as LeaveType,
    startDate,
    endDate,
    halfDayStart: formData.get("halfDayStart") === "on",
    halfDayEnd: formData.get("halfDayEnd") === "on",
    comment: String(formData.get("comment") || "") || undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return {
      ok: false,
      message: first ?? "Les informations saisies sont invalides.",
    };
  }

  return { ok: true, input: parsed.data };
}
