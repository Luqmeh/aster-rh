"use client";

import { useState, useTransition } from "react";
import { hrUpdateWorkAbsenceAction } from "@/app/actions/work-absence";
import {
  WORK_ABSENCE_STATUSES,
  workAbsenceStatusLabel,
} from "@/domain/rules/work-absence";
import type { WorkAbsence, WorkAbsenceStatus } from "@/domain/types/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WorkAbsenceHrForm({ absence }: { absence: WorkAbsence }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await hrUpdateWorkAbsenceAction({
        absenceId: absence.id,
        status: String(formData.get("status")) as WorkAbsenceStatus,
        hrMessage: String(formData.get("hrMessage") ?? "") || null,
        hrInternalNote: String(formData.get("hrInternalNote") ?? "") || null,
        rejectionReason: String(formData.get("rejectionReason") ?? "") || null,
        startDate: String(formData.get("startDate") ?? "") || undefined,
        endDate: String(formData.get("endDate") ?? "") || undefined,
        actualReturnDate:
          String(formData.get("actualReturnDate") ?? "") || null,
        returnVisitPlannedDate:
          String(formData.get("returnVisitPlannedDate") ?? "") || null,
        returnVisitStatus: String(
          formData.get("returnVisitStatus") ?? absence.returnVisitStatus,
        ) as WorkAbsence["returnVisitStatus"],
        markDocumentReceived: formData.get("markDocumentReceived") === "on",
        parentAbsenceId:
          String(formData.get("parentAbsenceId") ?? "") || undefined,
        recurrenceOfId:
          String(formData.get("recurrenceOfId") ?? "") || undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("Dossier mis à jour.");
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="status">Statut</Label>
          <select
            id="status"
            name="status"
            defaultValue={absence.status}
            className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
          >
            {WORK_ABSENCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {workAbsenceStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="markDocumentReceived"
              defaultChecked={absence.documentsReceived}
            />
            Justificatif reçu
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Début</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={absence.startDate}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Fin</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={absence.endDate}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="actualReturnDate">Retour effectif</Label>
          <Input
            id="actualReturnDate"
            name="actualReturnDate"
            type="date"
            defaultValue={absence.actualReturnDate ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="returnVisitPlannedDate">
            Visite de reprise (planifiée)
          </Label>
          <Input
            id="returnVisitPlannedDate"
            name="returnVisitPlannedDate"
            type="date"
            defaultValue={absence.returnVisitPlannedDate ?? ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="returnVisitStatus">Statut visite reprise</Label>
        <select
          id="returnVisitStatus"
          name="returnVisitStatus"
          defaultValue={absence.returnVisitStatus}
          className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
        >
          <option value="non_applicable">Non applicable</option>
          <option value="non_requise">Non requise</option>
          <option value="a_planifier">À planifier</option>
          <option value="planifiee">Planifiée</option>
          <option value="realisee">Réalisée</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hrMessage">Message collaborateur</Label>
        <Textarea
          id="hrMessage"
          name="hrMessage"
          rows={2}
          defaultValue={absence.hrMessage ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hrInternalNote">Note interne RH (confidentielle)</Label>
        <Textarea
          id="hrInternalNote"
          name="hrInternalNote"
          rows={2}
          defaultValue={absence.hrInternalNote ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rejectionReason">Motif de refus</Label>
        <Textarea
          id="rejectionReason"
          name="rejectionReason"
          rows={2}
          defaultValue={absence.rejectionReason ?? ""}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="parentAbsenceId">Lien prolongation (id)</Label>
          <Input
            id="parentAbsenceId"
            name="parentAbsenceId"
            defaultValue={absence.parentAbsenceId ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recurrenceOfId">Lien rechute (id)</Label>
          <Input
            id="recurrenceOfId"
            name="recurrenceOfId"
            defaultValue={absence.recurrenceOfId ?? ""}
          />
        </div>
      </div>

      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
      {message ? (
        <p className="text-[13px] text-emerald-800">{message}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
