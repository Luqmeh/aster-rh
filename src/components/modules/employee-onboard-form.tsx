"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { onboardEmployeeAction } from "@/app/actions/employee-lifecycle";
import type { DemoRole } from "@/domain/types/hr";
import type { OrganizationUnit, Employee } from "@/domain/types/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm text-[var(--aster-ink)]";

export function EmployeeOnboardForm({
  departments,
  managers,
  canAssignPrivilegedRoles,
}: {
  departments: OrganizationUnit[];
  managers: Employee[];
  canAssignPrivilegedRoles: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        setTempPassword(null);
        startTransition(async () => {
          try {
            const result = await onboardEmployeeAction({
              id: String(form.get("id") ?? "").trim(),
              firstName: String(form.get("firstName") ?? "").trim(),
              lastName: String(form.get("lastName") ?? "").trim(),
              email: String(form.get("email") ?? "").trim(),
              jobTitle: String(form.get("jobTitle") ?? "").trim(),
              departmentId: String(form.get("departmentId") ?? ""),
              managerId: String(form.get("managerId") ?? "") || null,
              site: String(form.get("site") ?? "").trim(),
              contractType: String(form.get("contractType") ?? "cdi") as
                | "cdi"
                | "cdd"
                | "alternance"
                | "stage",
              category: String(form.get("category") ?? "cadre") as
                | "cadre"
                | "non_cadre",
              hireDate: String(form.get("hireDate") ?? ""),
              phoneInternal: String(form.get("phoneInternal") ?? "").trim() || null,
              provisionAccount: form.get("provisionAccount") === "true",
              role: String(form.get("role") ?? "collaborateur") as DemoRole,
            });
            if (result.temporaryPassword) {
              setTempPassword(result.temporaryPassword);
            }
            router.push(`/annuaire/${result.employeeId}`);
            router.refresh();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Création impossible.",
            );
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Identifiant" name="id" placeholder="emp-nouveau" required />
        <Field label="E-mail professionnel" name="email" type="email" required />
        <Field label="Prénom" name="firstName" required />
        <Field label="Nom" name="lastName" required />
        <Field label="Poste" name="jobTitle" required />
        <Field label="Site" name="site" required />
        <Field label="Date d'entrée" name="hireDate" type="date" required />
        <Field label="Téléphone interne" name="phoneInternal" />
        <div className="space-y-1.5">
          <Label htmlFor="departmentId">Département</Label>
          <select id="departmentId" name="departmentId" className={selectClassName} required>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="managerId">Manager hiérarchique</Label>
          <select id="managerId" name="managerId" className={selectClassName} defaultValue="">
            <option value="">— (direction)</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contractType">Contrat</Label>
          <select id="contractType" name="contractType" className={selectClassName} defaultValue="cdi">
            <option value="cdi">CDI</option>
            <option value="cdd">CDD</option>
            <option value="alternance">Alternance</option>
            <option value="stage">Stage</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Catégorie</Label>
          <select id="category" name="category" className={selectClassName} defaultValue="cadre">
            <option value="cadre">Cadre</option>
            <option value="non_cadre">Non-cadre</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Rôle applicatif</Label>
          <select id="role" name="role" className={selectClassName} defaultValue="collaborateur">
            <option value="collaborateur">Collaborateur</option>
            {canAssignPrivilegedRoles ? (
              <>
                <option value="admin_rh">Ressources humaines</option>
                <option value="chef_de_projet">Chef de projet</option>
              </>
            ) : null}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provisionAccount">Compte de connexion</Label>
          <select
            id="provisionAccount"
            name="provisionAccount"
            className={selectClassName}
            defaultValue="true"
          >
            <option value="true">Créer un compte credentials</option>
            <option value="false">Fiche seule (sans compte)</option>
          </select>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer le collaborateur"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-[var(--aster-danger)]">
          {error}
        </p>
      ) : null}
      {tempPassword ? (
        <p role="status" className="rounded-[8px] border border-[var(--aster-border)] bg-[var(--aster-surface-2)] px-3 py-2 text-xs">
          Mot de passe temporaire (affiché une seule fois) :{" "}
          <strong className="font-mono">{tempPassword}</strong>
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
