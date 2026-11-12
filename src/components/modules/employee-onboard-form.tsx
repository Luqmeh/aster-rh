"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { onboardEmployeeAction } from "@/app/actions/employee-lifecycle";
import { createPeopleManagerAction } from "@/app/actions/people-manager";
import { OnboardingCredentialsModal } from "@/components/modules/onboarding-credentials-modal";
import type { DemoRole, PeopleManagerEntry } from "@/domain/types/hr";
import {
  EMPLOYEE_CONTRACT_OPTIONS,
  EMPLOYEE_GRADE_OPTIONS,
} from "@/domain/types/employee-structure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canSubmitOnboardForm,
  credentialsFromOnboardResult,
  type OnboardingCredentials,
} from "@/lib/onboarding-credentials";

const selectClassName =
  "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm text-[var(--aster-ink)]";

export function EmployeeOnboardForm({
  peopleManagers: initialPeopleManagers,
  canAssignPrivilegedRoles,
}: {
  peopleManagers: PeopleManagerEntry[];
  canAssignPrivilegedRoles: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<OnboardingCredentials | null>(
    null,
  );
  const [peopleManagers, setPeopleManagers] = useState(initialPeopleManagers);
  const [newPmName, setNewPmName] = useState("");

  const submitEnabled = canSubmitOnboardForm({
    pending,
    credentialsVisible: Boolean(credentials),
  });

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!submitEnabled) return;
          const form = new FormData(event.currentTarget);
          setError(null);
          startTransition(async () => {
            try {
              const email = String(form.get("email") ?? "").trim();
              const result = await onboardEmployeeAction({
                id: String(form.get("id") ?? "").trim(),
                firstName: String(form.get("firstName") ?? "").trim(),
                lastName: String(form.get("lastName") ?? "").trim(),
                email,
                peopleManagerId:
                  String(form.get("peopleManagerId") ?? "") || null,
                region: String(form.get("region") ?? "").trim(),
                contractType: String(form.get("contractType") ?? "cdi") as
                  | "cdi"
                  | "stage",
                grade: String(form.get("grade") ?? "auditeur_junior"),
                hireDate: String(form.get("hireDate") ?? ""),
                phoneInternal:
                  String(form.get("phoneInternal") ?? "").trim() || null,
                provisionAccount: form.get("provisionAccount") === "true",
                role: String(form.get("role") ?? "collaborateur") as DemoRole,
              });
              const next = credentialsFromOnboardResult({
                employeeId: result.employeeId,
                email,
                temporaryPassword: result.temporaryPassword,
              });
              if (next) {
                setCredentials(next);
                return;
              }
              router.push(`/annuaire/${result.employeeId}`);
              router.refresh();
            } catch (err) {
              setCredentials(null);
              setError(
                err instanceof Error ? err.message : "Création impossible.",
              );
            }
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Matricule"
            name="id"
            placeholder="emp-nouveau"
            required
          />
          <Field label="E-mail professionnel" name="email" type="email" required />
          <Field label="Prénom" name="firstName" required />
          <Field label="Nom" name="lastName" required />
          <Field label="Région" name="region" required />
          <Field label="Date d'entrée" name="hireDate" type="date" required />
          <Field label="Téléphone interne" name="phoneInternal" />
          <div className="space-y-1.5">
            <Label htmlFor="peopleManagerId">People Manager</Label>
            <select
              id="peopleManagerId"
              name="peopleManagerId"
              className={selectClassName}
              defaultValue=""
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
              defaultValue="cdi"
            >
              {EMPLOYEE_CONTRACT_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade">Grade</Label>
            <select
              id="grade"
              name="grade"
              className={selectClassName}
              defaultValue="auditeur_junior"
              required
            >
              {EMPLOYEE_GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Rôle applicatif</Label>
            <select id="role" name="role" className={selectClassName} defaultValue="collaborateur">
              <option value="collaborateur">Collaborateur</option>
              {canAssignPrivilegedRoles ? (
                <>
                  <option value="admin_rh">Responsable RH</option>
                  <option value="chef_de_projet">Senior Manager</option>
                </>
              ) : null}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provisionAccount">Compte applicatif</Label>
            <select
              id="provisionAccount"
              name="provisionAccount"
              className={selectClassName}
              defaultValue="true"
            >
              <option value="true">Créer un compte (mot de passe temporaire)</option>
              <option value="false">Fiche seule (sans connexion)</option>
            </select>
          </div>
        </div>
        <Button type="submit" size="sm" disabled={!submitEnabled}>
          {pending ? "Création…" : "Créer le collaborateur"}
        </Button>
        {error ? (
          <p role="alert" className="text-xs text-[var(--aster-danger)]">
            {error}
          </p>
        ) : null}
      </form>
      <OnboardingCredentialsModal
        open={Boolean(credentials)}
        credentials={credentials}
        onClose={() => {
          const employeeId = credentials?.employeeId;
          setCredentials(null);
          if (employeeId) {
            router.push(`/annuaire/${employeeId}`);
            router.refresh();
          }
        }}
      />
    </>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
