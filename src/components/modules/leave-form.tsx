"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitLeaveAction } from "@/app/actions/leave";
import {
  emptyLeaveFeedback,
  parseAndValidateLeaveForm,
  resetLeaveFormElement,
  resolveLeaveSubmissionUi,
  shouldBlockLeaveSubmit,
  type LeaveFormFeedback,
} from "@/components/modules/leave-form-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVE_LEAVE_REQUEST_TYPES } from "@/domain/rules/active-leave-types";

const TYPES = ACTIVE_LEAVE_REQUEST_TYPES;

export function LeaveForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<LeaveFormFeedback>(emptyLeaveFeedback);

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (shouldBlockLeaveSubmit(pending)) return;

        const formElement = formRef.current ?? event.currentTarget;
        const formData = new FormData(formElement);
        const validated = parseAndValidateLeaveForm(formData);

        if (!validated.ok) {
          const ui = resolveLeaveSubmissionUi({
            kind: "validation",
            message: validated.message,
          });
          setFeedback(ui.feedback);
          return;
        }

        setFeedback(emptyLeaveFeedback());

        startTransition(async () => {
          try {
            const result = await submitLeaveAction(validated.input);
            if (!result?.ok || !result.id) {
              const ui = resolveLeaveSubmissionUi({
                kind: "failure",
                error: new Error("La demande n'a pas pu être enregistrée."),
              });
              setFeedback(ui.feedback);
              return;
            }

            const ui = resolveLeaveSubmissionUi({
              kind: "success",
              requestId: result.id,
            });
            setFeedback(ui.feedback);
            if (ui.shouldReset) {
              resetLeaveFormElement(formElement);
            }
            router.refresh();
          } catch (err) {
            const ui = resolveLeaveSubmissionUi({
              kind: "failure",
              error: err,
            });
            setFeedback(ui.feedback);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            required
            className="flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 text-sm text-[var(--aster-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aster-accent)]/35"
            defaultValue="conges_payes"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-1" />
        <div className="space-y-2">
          <Label htmlFor="startDate">Date de début</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Date de fin</Label>
          <Input id="endDate" name="endDate" type="date" required />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="halfDayStart" className="rounded" />
          Demi-journée au début
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="halfDayEnd" className="rounded" />
          Demi-journée à la fin
        </label>
      </div>
      <p className="text-xs text-[var(--aster-muted)]">
        Arrêt maladie et absences spéciales : utiliser{" "}
        <Link href="/absences" className="underline">
          Arrêts &amp; absences spéciales
        </Link>
        .
      </p>
      <div className="space-y-2">
        <Label htmlFor="comment">Commentaire</Label>
        <Textarea id="comment" name="comment" placeholder="Optionnel" />
      </div>
      {feedback.error ? (
        <p
          role="alert"
          className="rounded-md bg-[var(--aster-danger-bg)] px-3 py-2 text-sm text-[var(--aster-danger)]"
        >
          {feedback.error}
        </p>
      ) : null}
      {feedback.success ? (
        <p
          role="status"
          className="rounded-md bg-[var(--aster-success-bg)] px-3 py-2 text-sm text-[var(--aster-success)]"
        >
          {feedback.success}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Soumettre la demande"}
      </Button>
    </form>
  );
}
