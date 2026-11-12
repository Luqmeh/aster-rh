"use client";

import { useState, useTransition } from "react";
import { updatePersonalProfileAction } from "@/app/actions/employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PersonalProfileForm({
  employeeId,
  phoneInternal,
}: {
  employeeId: string;
  phoneInternal: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          try {
            await updatePersonalProfileAction(employeeId, {
              phoneInternal: String(form.get("phoneInternal") ?? "").trim() || null,
            });
            setSuccess("Informations personnelles enregistrées.");
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Enregistrement impossible.",
            );
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phoneInternal">Téléphone interne</Label>
          <Input
            id="phoneInternal"
            name="phoneInternal"
            defaultValue={phoneInternal ?? ""}
            placeholder="Ex. +212 5 22 00 00 00"
          />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
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
