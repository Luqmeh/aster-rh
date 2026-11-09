"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmWorkOnHolidayCreditAction,
  decideWorkOnHolidayAction,
  declareWorkOnHolidayActualAction,
  submitWorkOnHolidayAction,
} from "@/app/actions/work-on-holiday";
import type { DemoRole } from "@/domain/types/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WorkOnHolidayRequestForm({
  holidayDate,
  holidayName,
}: {
  holidayDate: string;
  holidayName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const result = await submitWorkOnHolidayAction({
            holidayDate,
            plannedHours: Number(form.get("plannedHours") ?? 0),
            plannedStart: String(form.get("plannedStart") ?? "") || undefined,
            plannedEnd: String(form.get("plannedEnd") ?? "") || undefined,
            reason: String(form.get("reason") ?? ""),
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setSuccess("Demande envoyée au Chef de projet.");
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-[var(--aster-muted)]">
        Demande de travail le <strong>{holidayDate}</strong> — {holidayName}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="plannedHours">Heures prévues</Label>
          <Input
            id="plannedHours"
            name="plannedHours"
            type="number"
            min={0.5}
            max={24}
            step={0.5}
            defaultValue={7}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="plannedStart">Début</Label>
          <Input id="plannedStart" name="plannedStart" type="time" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="plannedEnd">Fin</Label>
          <Input id="plannedEnd" name="plannedEnd" type="time" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="reason">Justification métier</Label>
        <Textarea id="reason" name="reason" required className="min-h-[70px]" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Envoi…" : "Soumettre pour approbation"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-[var(--aster-danger)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-xs text-[var(--aster-success)]">
          {success}
        </p>
      ) : null}
    </form>
  );
}

export function WorkOnHolidayChefActions({
  requestId,
  status,
  actualHours,
  plannedHours,
  role,
}: {
  requestId: string;
  status: string;
  actualHours: number | null;
  plannedHours: number;
  role: DemoRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [confirmedHours, setConfirmedHours] = useState(
    String(actualHours ?? plannedHours),
  );

  if (role !== "chef_de_projet") {
    return null;
  }

  return (
    <div className="space-y-2 border-t border-[var(--aster-border)] pt-2">
      {status === "en_attente" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await decideWorkOnHolidayAction(
                  requestId,
                  "approuvee",
                );
                if (!r.ok) setError(r.message);
                else router.refresh();
              })
            }
          >
            Approuver
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await decideWorkOnHolidayAction(
                  requestId,
                  "refusee",
                  comment || "Refus Chef de projet",
                );
                if (!r.ok) setError(r.message);
                else router.refresh();
              })
            }
          >
            Refuser
          </Button>
          <Input
            placeholder="Motif de refus"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="max-w-xs"
          />
        </div>
      ) : null}

      {status === "travail_effectue_a_confirmer" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor={`conf-${requestId}`}>Heures confirmées</Label>
            <Input
              id={`conf-${requestId}`}
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={confirmedHours}
              onChange={(e) => setConfirmedHours(e.target.value)}
              className="w-28"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await confirmWorkOnHolidayCreditAction(
                  requestId,
                  Number(confirmedHours),
                );
                if (!r.ok) setError(r.message);
                else router.refresh();
              })
            }
          >
            Confirmer et créditer
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-[var(--aster-danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export function WorkOnHolidayDeclareActual({
  requestId,
  plannedHours,
}: {
  requestId: string;
  plannedHours: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(String(plannedHours));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor={`act-${requestId}`}>Heures réelles</Label>
        <Input
          id={`act-${requestId}`}
          type="number"
          min={0.5}
          max={24}
          step={0.5}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-28"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await declareWorkOnHolidayActualAction(
              requestId,
              Number(hours),
            );
            if (!r.ok) setError(r.message);
            else router.refresh();
          })
        }
      >
        Déclarer les heures
      </Button>
      {error ? (
        <p className="text-xs text-[var(--aster-danger)]">{error}</p>
      ) : null}
    </div>
  );
}
