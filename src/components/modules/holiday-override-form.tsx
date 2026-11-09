"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertHolidayOverrideAction } from "@/app/actions/work-on-holiday";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm";

export function HolidayOverrideForm() {
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
        const date = String(form.get("date") ?? "");
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const result = await upsertHolidayOverrideAction({
            sourceKey: String(form.get("sourceKey") ?? "").trim() || `company_${date}`,
            date,
            nameFr: String(form.get("nameFr") ?? ""),
            kind: String(form.get("kind") ?? "company") as
              | "national"
              | "religious"
              | "company",
            confirmation: String(form.get("confirmation") ?? "confirmed") as
              | "confirmed"
              | "provisional",
            isActive: true,
            year: Number(date.slice(0, 4)),
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setSuccess("Jour férié enregistré / corrigé.");
          router.refresh();
        });
      }}
    >
      <p className="text-xs text-[var(--aster-muted)]">
        Correction d&apos;une date curated ou ajout d&apos;un jour entreprise.
        Clé stable = dédoublonnage (ex. throne_day, company_bridge_2026).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="sourceKey">Clé source</Label>
          <Input id="sourceKey" name="sourceKey" placeholder="company_bridge" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" required />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="nameFr">Libellé</Label>
          <Input id="nameFr" name="nameFr" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="kind">Type</Label>
          <select id="kind" name="kind" className={selectClassName} defaultValue="company">
            <option value="company">Entreprise</option>
            <option value="national">National</option>
            <option value="religious">Religieux</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirmation">Confirmation</Label>
          <select
            id="confirmation"
            name="confirmation"
            className={selectClassName}
            defaultValue="confirmed"
          >
            <option value="confirmed">Confirmé</option>
            <option value="provisional">Provisoire</option>
          </select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Enregistrer
      </Button>
      {error ? (
        <p className="text-xs text-[var(--aster-danger)]">{error}</p>
      ) : null}
      {success ? (
        <p className="text-xs text-[var(--aster-success)]">{success}</p>
      ) : null}
    </form>
  );
}
