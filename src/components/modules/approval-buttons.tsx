"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideLeaveAction } from "@/app/actions/leave";
import { decideTeleworkAction } from "@/app/actions/telework";
import {
  approvalButtonLabel,
  emptyApprovalFeedback,
  resolveApprovalUi,
  shouldBlockApprovalAction,
  type ApprovalDecision,
  type ApprovalFeedback,
} from "@/components/modules/approval-logic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ApprovalButtons({
  kind,
  requestId,
  requireRejectionReason = false,
}: {
  kind: "leave" | "telework";
  requestId: string;
  requireRejectionReason?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingDecision, setPendingDecision] =
    useState<ApprovalDecision | null>(null);
  const [feedback, setFeedback] = useState<ApprovalFeedback>(
    emptyApprovalFeedback,
  );
  const [resolved, setResolved] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  function decide(decision: ApprovalDecision) {
    if (shouldBlockApprovalAction(pending) || resolved) return;

    if (
      decision === "refusee" &&
      requireRejectionReason &&
      !rejectionReason.trim()
    ) {
      setShowRejectForm(true);
      setFeedback(
        resolveApprovalUi({
          kind: "failure",
          error: new Error("Indiquez un motif de refus."),
        }),
      );
      return;
    }

    setFeedback(emptyApprovalFeedback());
    setPendingDecision(decision);

    startTransition(async () => {
      try {
        const comment =
          decision === "refusee" ? rejectionReason.trim() || undefined : undefined;
        const result =
          kind === "leave"
            ? await decideLeaveAction(requestId, decision, comment)
            : await decideTeleworkAction(requestId, decision, comment);

        if (!result?.ok) {
          setFeedback(
            resolveApprovalUi({
              kind: "failure",
              error: new Error("La décision n'a pas pu être enregistrée."),
            }),
          );
          setPendingDecision(null);
          return;
        }

        setFeedback(
          resolveApprovalUi({
            kind: "success",
            decision: result.decision,
          }),
        );
        setResolved(true);
        setPendingDecision(null);
        setShowRejectForm(false);
        router.refresh();
      } catch (err) {
        setFeedback(resolveApprovalUi({ kind: "failure", error: err }));
        setPendingDecision(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      {(requireRejectionReason || showRejectForm) && !resolved ? (
        <Textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Motif de refus (obligatoire pour un refus de plan)"
          className="min-h-[64px] text-sm"
        />
      ) : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="accent"
          disabled={pending || resolved}
          onClick={() => decide("approuvee")}
        >
          {approvalButtonLabel("approuvee", pending, pendingDecision)}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || resolved}
          onClick={() => {
            if (requireRejectionReason && !rejectionReason.trim()) {
              setShowRejectForm(true);
            }
            decide("refusee");
          }}
        >
          {approvalButtonLabel("refusee", pending, pendingDecision)}
        </Button>
      </div>
      {feedback.error ? (
        <p role="alert" className="text-xs text-[var(--aster-danger)]">
          {feedback.error}
        </p>
      ) : null}
      {feedback.success ? (
        <p role="status" className="text-xs text-[var(--aster-success)]">
          {feedback.success}
        </p>
      ) : null}
    </div>
  );
}
