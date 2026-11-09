"use client";

import { useState, useTransition } from "react";
import { declareWorkAbsenceAction } from "@/app/actions/work-absence";
import {
  ARRET_CATEGORIES,
  reminderBannerTexts,
  workAbsenceCategoryLabel,
} from "@/domain/rules/work-absence";
import {
  SPECIAL_LEAVE_ENTITLEMENTS,
} from "@/domain/rules/special-leave-entitlements";
import type { WorkAbsenceCategory } from "@/domain/types/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WorkAbsenceForm({
  parentOptions = [],
}: {
  parentOptions?: { id: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<WorkAbsenceCategory>("arret_maladie");
  const reminders = reminderBannerTexts();
  const entitlement = SPECIAL_LEAVE_ENTITLEMENTS.find(
    (e) => e.category === category,
  );

  function onSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await declareWorkAbsenceAction({
        category: String(formData.get("category")) as WorkAbsenceCategory,
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        comment: String(formData.get("comment") ?? "") || undefined,
        parentAbsenceId: String(formData.get("parentAbsenceId") ?? "") || null,
        recurrenceOfId: String(formData.get("recurrenceOfId") ?? "") || null,
        hospitalAdmissionDate:
          String(formData.get("hospitalAdmissionDate") ?? "") || null,
        hospitalDischargeDate:
          String(formData.get("hospitalDischargeDate") ?? "") || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(
        "Déclaration enregistrée. Vous pouvez ajouter un justificatif ensuite.",
      );
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2 rounded-lg border border-[var(--aster-border)] bg-[var(--aster-workspace)] p-3 text-[12px] text-[var(--aster-muted)]">
        <p>{reminders.notify24h}</p>
        <p>{reminders.docs48h}</p>
        <p>{reminders.payrollCutoff}</p>
        <p>
          Ne communiquez pas de diagnostic médical — seuls les justificatifs
          administratifs sont demandés.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Catégorie</Label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as WorkAbsenceCategory)
          }
          className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
        >
          <optgroup label="Arrêts">
            {ARRET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {workAbsenceCategoryLabel(c)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Congés spéciaux (guide p.46)">
            {SPECIAL_LEAVE_ENTITLEMENTS.map((e) => (
              <option key={e.category} value={e.category}>
                {e.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {entitlement ? (
        <div className="rounded-md border border-[var(--aster-border)] bg-white p-3 text-[12px] text-[var(--aster-muted)]">
          <p>
            <span className="font-medium text-[var(--aster-ink)]">
              Éligibilité :
            </span>{" "}
            {entitlement.eligibility}
          </p>
          <p className="mt-1">
            <span className="font-medium text-[var(--aster-ink)]">
              Durée max :
            </span>{" "}
            {entitlement.maxDays != null
              ? `${entitlement.maxDays} j (indicatif)`
              : "selon guide — revue RH"}
          </p>
          <p className="mt-1">
            <span className="font-medium text-[var(--aster-ink)]">
              Justificatif :
            </span>{" "}
            {entitlement.supportingDocumentHint}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Date de début</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Date de fin prévue</Label>
          <Input id="endDate" name="endDate" type="date" required />
        </div>
      </div>

      {category === "prolongation_arret" ? (
        <div className="space-y-1.5">
          <Label htmlFor="parentAbsenceId">Arrêt d&apos;origine</Label>
          <select
            id="parentAbsenceId"
            name="parentAbsenceId"
            className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
            required
          >
            <option value="">Sélectionner…</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {category === "rechute" ? (
        <div className="space-y-1.5">
          <Label htmlFor="recurrenceOfId">Absence d&apos;origine (optionnel)</Label>
          <select
            id="recurrenceOfId"
            name="recurrenceOfId"
            className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
          >
            <option value="">À lier par RH si besoin</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {category === "arret_maladie" ||
      category === "hospitalisation_enfant" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hospitalAdmissionDate">
              Admission (hospitalisation)
            </Label>
            <Input
              id="hospitalAdmissionDate"
              name="hospitalAdmissionDate"
              type="date"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hospitalDischargeDate">Sortie</Label>
            <Input
              id="hospitalDischargeDate"
              name="hospitalDischargeDate"
              type="date"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="comment">Commentaire administratif</Label>
        <Textarea
          id="comment"
          name="comment"
          rows={3}
          placeholder="Sans diagnostic médical"
        />
      </div>

      {error ? (
        <p className="text-[13px] text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="text-[13px] text-emerald-800">{message}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Soumettre la déclaration"}
      </Button>
    </form>
  );
}
