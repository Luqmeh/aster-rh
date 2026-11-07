import {
  emptyFeedback,
  errorFeedback,
  errorFromUnknown,
  shouldBlockSubmit,
  type FormFeedback,
} from "@/components/modules/form-submission";
import type { Decision } from "@/domain/rules/approvals";

export type ApprovalFeedback = FormFeedback;
export type ApprovalDecision = Decision;

export const emptyApprovalFeedback = emptyFeedback;
export const shouldBlockApprovalAction = shouldBlockSubmit;

export function approvalSuccessMessage(decision: ApprovalDecision): string {
  return decision === "approuvee"
    ? "Demande approuvée."
    : "Demande refusée.";
}

export function resolveApprovalUi(
  outcome:
    | { kind: "success"; decision: ApprovalDecision }
    | { kind: "failure"; error: unknown },
): ApprovalFeedback {
  if (outcome.kind === "success") {
    return {
      success: approvalSuccessMessage(outcome.decision),
      error: null,
    };
  }
  return errorFeedback(errorFromUnknown(outcome.error));
}

export function approvalButtonLabel(
  decision: ApprovalDecision,
  pending: boolean,
  pendingDecision: ApprovalDecision | null,
): string {
  const loading = pending && pendingDecision === decision;
  if (decision === "approuvee") {
    return loading ? "Approbation…" : "Approuver";
  }
  return loading ? "Refus…" : "Refuser";
}
