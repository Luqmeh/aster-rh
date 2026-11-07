"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitMonthlyTeleworkPlanAction,
  updateMonthlyTeleworkPlanAction,
  withdrawMonthlyTeleworkPlanAction,
} from "@/app/actions/telework";
import {
  createPlanSuccessMessage,
  updatePlanSuccessMessage,
} from "@/components/modules/telework-plan-edit";
import {
  emptyFeedback,
  errorFeedback,
  resolveSubmissionUi,
  shouldBlockSubmit,
  type FormFeedback,
} from "@/components/modules/form-submission";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addMonths,
  formatMonthYearFr,
  formatDayMonthFr,
  nextMonthKey,
  weekdayLabelFr,
} from "@/domain/rules/dates";
import {
  MAX_TELEWORK_DAYS_PER_MONTH,
  MAX_TELEWORK_DAYS_PER_WEEK,
  planningWeeksForMonth,
  validateMonthlyTeleworkPlan,
} from "@/domain/rules/telework-monthly";
import { cn, formatDateFr } from "@/lib/utils";

type WeekBucket = ReturnType<typeof planningWeeksForMonth>[number];

export function MonthlyTeleworkPlanner({
  eligible,
  eligibilityMessage,
  initialMonth,
  editingPlanId,
  initialDays,
  initialReason,
}: {
  eligible: boolean;
  eligibilityMessage?: string;
  initialMonth?: string;
  editingPlanId?: string | null;
  initialDays?: string[];
  initialReason?: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(editingPlanId);
  const [month, setMonth] = useState(initialMonth ?? nextMonthKey());
  const [selected, setSelected] = useState<string[]>(initialDays ?? []);
  const [reason, setReason] = useState(initialReason ?? "");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback>(emptyFeedback);

  const weeks = useMemo(() => planningWeeksForMonth(month), [month]);

  function countInWeek(week: WeekBucket) {
    return selected.filter((d) => week.days.includes(d)).length;
  }

  function toggleDay(day: string, week: WeekBucket) {
    setFeedback(emptyFeedback());
    setSelected((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      const inWeek = prev.filter((d) => week.days.includes(d));
      if (inWeek.length >= MAX_TELEWORK_DAYS_PER_WEEK) {
        setFeedback(
          resolveSubmissionUi({
            kind: "validation",
            message: `Maximum ${MAX_TELEWORK_DAYS_PER_WEEK} jours par semaine.`,
          }).feedback,
        );
        return prev;
      }
      if (prev.length >= MAX_TELEWORK_DAYS_PER_MONTH) {
        setFeedback(
          resolveSubmissionUi({
            kind: "validation",
            message: `Maximum ${MAX_TELEWORK_DAYS_PER_MONTH} jours par mois (guide RH p.106).`,
          }).feedback,
        );
        return prev;
      }
      return [...prev, day].sort();
    });
  }

  function submit() {
    if (!eligible || shouldBlockSubmit(pending)) return;
    const validated = validateMonthlyTeleworkPlan(month, selected);
    if (!validated.ok) {
      setFeedback(
        resolveSubmissionUi({
          kind: "validation",
          message: validated.message,
        }).feedback,
      );
      return;
    }

    setFeedback(emptyFeedback());
    startTransition(async () => {
      try {
        const payload = {
          month,
          days: validated.days,
          reason: reason.trim() || undefined,
        };
        const result = editingPlanId
          ? await updateMonthlyTeleworkPlanAction(editingPlanId, payload)
          : await submitMonthlyTeleworkPlanAction(payload);
        if (!result?.ok) {
          setFeedback(
            errorFeedback("Le plan n'a pas pu être enregistré."),
          );
          return;
        }
        setFeedback({
          success: editingPlanId
            ? updatePlanSuccessMessage(result.id)
            : createPlanSuccessMessage(result.id),
          error: null,
        });
        if (!editingPlanId) {
          setSelected([]);
          setReason("");
        }
        router.refresh();
        if (editingPlanId) {
          router.push("/teletravail");
        }
      } catch (err) {
        setFeedback(
          resolveSubmissionUi({ kind: "failure", error: err }).feedback,
        );
      }
    });
  }

  if (!eligible) {
    return (
      <div className="rounded-xl border border-[var(--aster-warning)]/30 bg-[var(--aster-warning-bg)] px-4 py-3 text-sm text-[var(--aster-warning)]">
        {eligibilityMessage ??
          "Profil non éligible au télétravail selon le guide RH (p.106)."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--aster-accent)]/30 bg-[#e7f2f8] px-4 py-3 text-sm text-[var(--aster-accent)]">
          <p>
            <span className="font-semibold">Modification</span> du plan en
            attente — {formatMonthYearFr(month)}. Les plafonds 2 j/semaine et 12
            j/mois restent applicables.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/teletravail">Annuler</Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--aster-muted)]">
            {isEditing ? "Mois du plan (verrouillé)" : "Mois planifié"}
          </p>
          <p className="text-xl font-semibold capitalize tracking-tight text-[var(--aster-ink)]">
            {formatMonthYearFr(month)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isEditing}
            onClick={() => {
              setMonth((m) => addMonths(m, -1));
              setSelected([]);
            }}
          >
            Mois précédent
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isEditing}
            onClick={() => {
              setMonth((m) => addMonths(m, 1));
              setSelected([]);
            }}
          >
            Mois suivant
          </Button>
        </div>
      </div>

      <p className="text-sm text-[var(--aster-muted)]">
        Limite produit : {MAX_TELEWORK_DAYS_PER_WEEK} j/semaine · Plafond guide
        RH (p.106) : {MAX_TELEWORK_DAYS_PER_MONTH} j/mois. Sélection :{" "}
        <strong className="text-[var(--aster-ink)]">{selected.length}</strong>{" "}
        jour(s).
      </p>

      <div className="space-y-4">
        {weeks.map((week) => (
          <div
            key={week.weekKey}
            className="rounded-xl border border-[var(--aster-border)] bg-[var(--aster-surface)]/60 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--aster-ink)]">
                {week.label}
              </p>
              <p className="text-xs text-[var(--aster-muted)]">
                {countInWeek(week)}/{MAX_TELEWORK_DAYS_PER_WEEK}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {week.days.map((day) => {
                const active = selected.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day, week)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "border-[var(--aster-accent)] bg-[var(--aster-accent)] text-white"
                        : "border-[var(--aster-border)] bg-white text-[var(--aster-ink)] hover:bg-[var(--aster-surface-2)]",
                    )}
                  >
                    <span className="block text-[11px] capitalize opacity-80">
                      {weekdayLabelFr(day)}
                    </span>
                    <span className="font-medium">{formatDayMonthFr(day)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--aster-border)] bg-white p-4">
        <p className="mb-2 text-sm font-medium">Récapitulatif</p>
        {selected.length === 0 ? (
          <p className="text-sm text-[var(--aster-muted)]">
            Aucun jour sélectionné.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {selected.map((d) => (
              <li
                key={d}
                className="rounded-md bg-[var(--aster-surface-2)] px-2 py-1"
              >
                {formatDateFr(d)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tw-reason">Commentaire (optionnel)</Label>
        <Textarea
          id="tw-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Précisions pour le manager"
        />
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

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending
            ? isEditing
              ? "Mise à jour…"
              : "Envoi…"
            : isEditing
              ? "Enregistrer les modifications"
              : "Soumettre le plan mensuel"}
        </Button>
        {isEditing ? (
          <Button asChild type="button" variant="ghost" disabled={pending}>
            <Link href="/teletravail">Annuler la modification</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function WithdrawPlanButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await withdrawMonthlyTeleworkPlanAction(requestId);
              router.refresh();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Retrait impossible.",
              );
            }
          });
        }}
      >
        {pending ? "Retrait…" : "Retirer le plan"}
      </Button>
      {error ? (
        <p className="text-xs text-[var(--aster-danger)]">{error}</p>
      ) : null}
    </div>
  );
}
