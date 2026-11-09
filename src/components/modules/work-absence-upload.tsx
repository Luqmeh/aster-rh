"use client";

import { useState, useTransition } from "react";
import { uploadWorkAbsenceDocumentAction } from "@/app/actions/work-absence";
import {
  absenceDocumentKindLabel,
} from "@/domain/rules/work-absence";
import type { AbsenceDocumentKind } from "@/domain/types/hr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const KINDS: AbsenceDocumentKind[] = [
  "certificat_initial",
  "certificat_prolongation",
  "bulletin_hospitalisation",
  "dossier_at_mp",
  "calendrier_maternite",
  "notification_paternite",
  "justificatif_special",
  "autre",
];

export function WorkAbsenceUpload({ absenceId }: { absenceId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    formData.set("absenceId", absenceId);
    startTransition(async () => {
      const result = await uploadWorkAbsenceDocumentAction(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("Justificatif déposé.");
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="kind">Type de justificatif</Label>
        <select
          id="kind"
          name="kind"
          className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
          defaultValue="certificat_initial"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {absenceDocumentKindLabel(k)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="file">Fichier (PDF / image, max 8 Mo)</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,image/*"
          required
          className="block w-full text-sm"
        />
      </div>
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
      {message ? (
        <p className="text-[13px] text-emerald-800">{message}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Envoi…" : "Déposer le justificatif"}
      </Button>
    </form>
  );
}
