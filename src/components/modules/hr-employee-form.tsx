"use client";

import { useState, useTransition } from "react";
import { updateEmployeeHrAction } from "@/app/actions/employee";
import { createPeopleManagerAction } from "@/app/actions/people-manager";
import type {
  ContractType,
  Employee,
  OrganizationUnit,
  PeopleManagerEntry,
} from "@/domain/types/hr";
import { EMPLOYEE_GRADE_OPTIONS } from "@/domain/types/employee-structure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm text-[var(--aster-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aster-accent)]/35";

export function HrEmployeeForm({
  employee,
  departments,
  peopleManagers: initialPeopleManagers,
}: {
  employee: Employee;
  departments: OrganizationUnit[];
  peopleManagers: PeopleManagerEntry[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [peopleManagers, setPeopleManagers] = useState(initialPeopleManagers);
  const [newPmName, setNewPmName] = useState("");

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
            await updateEmployeeHrAction(employee.id, {
              firstName: String(form.get("firstName") ?? "").trim(),
              lastName: String(form.get("lastName") ?? "").trim(),
              email: String(form.get("email") ?? "").trim(),
              jobTitle: String(form.get("jobTitle") ?? "").trim(),
              departmentId: String(form.get("departmentId") ?? ""),
              peopleManagerId:
                String(form.get("peopleManagerId") ?? "") || null,
              region: String(form.get("region") ?? "").trim(),
              contractType: String(
                form.get("contractType") ?? "",
              ) as ContractType,
              grade: String(form.get("grade") ?? "") as Employee["grade"],
              hireDate: String(form.get("hireDate") ?? ""),
              phoneInternal:
                String(form.get("phoneInternal") ?? "").trim() || null,
              teleworkEligible: form.get("teleworkEligible") === "true",
            });
            setSuccess("Fiche collaborateur enregistrée.");
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
        <Field label="Prénom" name="firstName" defaultValue={employee.firstName} />
        <Field label="Nom" name="lastName" defaultValue={employee.lastName} />
        <Field label="E-mail" name="email" type="email" defaultValue={employee.email} />
        <Field label="Poste" name="jobTitle" defaultValue={employee.jobTitle} />
        <Field
          label="Téléphone interne"
          name="phoneInternal"
          defaultValue={employee.phoneInternal ?? ""}
        />
        <Field label="Région" name="region" defaultValue={employee.region} />
        <Field label="Date d'entrée" name="hireDate" type="date" defaultValue={employee.hireDate} />
        <div className="space-y-1.5">
          <Label htmlFor="departmentId">Département</Label>
          <select
            id="departmentId"
            name="departmentId"
            className={selectClassName}
            defaultValue={employee.departmentId}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="peopleManagerId">People Manager</Label>
          <select
            id="peopleManagerId"
            name="peopleManagerId"
            className={selectClassName}
            defaultValue={employee.peopleManagerId ?? ""}
          >
            <option value="">— (non assigné)</option>
            {peopleManagers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="newPmName">Ajouter un People Manager</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="newPmName"
              value={newPmName}
              onChange={(e) => setNewPmName(e.target.value)}
              placeholder="Nom (avec ou sans compte ASTER)"
              className="max-w-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !newPmName.trim()}
              onClick={() => {
                const name = newPmName.trim();
                if (!name) return;
                startTransition(async () => {
                  try {
                    const created = await createPeopleManagerAction({
                      displayName: name,
                    });
                    setPeopleManagers((prev) =>
                      [...prev, created].sort((a, b) =>
                        a.displayName.localeCompare(b.displayName, "fr"),
                      ),
                    );
                    setNewPmName("");
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Ajout People Manager impossible.",
                    );
                  }
                });
              }}
            >
              Ajouter
            </Button>
          </div>
          <p className="text-[12px] text-[var(--aster-muted)]">
            L&apos;affectation People Manager n&apos;accorde aucune autorité
            d&apos;approbation.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contractType">Contrat</Label>
          <select
            id="contractType"
            name="contractType"
            className={selectClassName}
            defaultValue={employee.contractType}
          >
            <option value="cdi">CDI</option>
            <option value="cdd">CDD</option>
            <option value="alternance">Alternance</option>
            <option value="stage">Stage</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grade">Grade</Label>
          <select
            id="grade"
            name="grade"
            className={selectClassName}
            defaultValue={employee.grade}
          >
            {EMPLOYEE_GRADE_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <p className="text-[12px] text-[var(--aster-muted)]">
            Cycle de vie (actif / inactif / parti) : utiliser le panneau
            dédié sur la fiche — ne pas basculer ici. Le grade est
            organisationnel uniquement (pas de droits ni soldes).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="teleworkEligible">Éligibilité télétravail</Label>
          <select
            id="teleworkEligible"
            name="teleworkEligible"
            className={selectClassName}
            defaultValue={employee.teleworkEligible ? "true" : "false"}
          >
            <option value="true">Éligible</option>
            <option value="false">Non éligible</option>
          </select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer la fiche"}
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

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}
