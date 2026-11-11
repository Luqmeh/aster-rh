"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Employee, OrganizationUnit } from "@/domain/types/hr";
import { fullName } from "@/lib/utils";

const PRESETS = [
  { value: "ce_mois", label: "Ce mois" },
  { value: "mois_precedent", label: "Mois précédent" },
  { value: "ce_trimestre", label: "Ce trimestre" },
  { value: "cette_annee", label: "Cette année" },
  { value: "personnalise", label: "Personnalisé" },
] as const;

export function ReportingFiltersForm({
  departments,
  employees,
  current,
}: {
  departments: OrganizationUnit[];
  employees: Employee[];
  current: {
    preset: string;
    startDate: string;
    endDate: string;
    departmentId: string;
    employeeId: string;
    employmentStatus: string;
    requestStatus: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [preset, setPreset] = useState(current.preset);
  const custom = preset === "personnalise";

  function apply(formData: FormData) {
    const next = new URLSearchParams(searchParams.toString());
    const keys = [
      "preset",
      "startDate",
      "endDate",
      "departmentId",
      "employeeId",
      "employmentStatus",
      "requestStatus",
    ] as const;
    for (const key of keys) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => {
      router.push(`/administration/rapports?${next.toString()}`);
    });
  }

  return (
    <form
      action={apply}
      className="rounded-xl border border-[var(--aster-border)] bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="preset">Période</Label>
          <select
            id="preset"
            name="preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Début</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={current.startDate}
            readOnly={!custom}
            className={!custom ? "bg-[var(--aster-workspace)]" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Fin</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={current.endDate}
            readOnly={!custom}
            className={!custom ? "bg-[var(--aster-workspace)]" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="departmentId">Département</Label>
          <select
            id="departmentId"
            name="departmentId"
            defaultValue={current.departmentId}
            className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
          >
            <option value="">Tous</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employeeId">Collaborateur</Label>
          <select
            id="employeeId"
            name="employeeId"
            defaultValue={current.employeeId}
            className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
          >
            <option value="">Tous</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {fullName(e.firstName, e.lastName)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employmentStatus">Statut collaborateur</Label>
          <select
            id="employmentStatus"
            name="employmentStatus"
            defaultValue={current.employmentStatus}
            className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
          >
            <option value="">Tous</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="parti">Parti</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="requestStatus">Statut demande (congés)</Label>
          <select
            id="requestStatus"
            name="requestStatus"
            defaultValue={current.requestStatus}
            className="flex h-10 w-full rounded-md border border-[var(--aster-border)] bg-white px-3 text-sm"
          >
            <option value="">Tous</option>
            <option value="soumise">Soumise</option>
            <option value="en_attente_manager">En attente manager</option>
            <option value="en_attente_rh">En attente de validation</option>
            <option value="approuvee">Approuvée</option>
            <option value="refusee">Refusée</option>
            <option value="annulee">Annulée</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Application…" : "Appliquer les filtres"}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-[var(--aster-muted)]">
        Fuseau : Africa/Casablanca · Période active : {current.startDate} →{" "}
        {current.endDate}
      </p>
    </form>
  );
}
