"use client";

import { useState, useTransition } from "react";
import {
  changeAccountRoleAction,
  changeEmploymentStatusAction,
} from "@/app/actions/employee-lifecycle";
import type { DemoRole, EmploymentStatus } from "@/domain/types/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm text-[var(--aster-ink)]";

export function LifecycleRoleControls({
  employeeId,
  employmentStatus,
  currentRole,
  canManageLifecycle,
  canAssignPrivilegedRoles,
  canEditRole,
}: {
  employeeId: string;
  employmentStatus: EmploymentStatus;
  currentRole: DemoRole | null;
  canManageLifecycle: boolean;
  canAssignPrivilegedRoles: boolean;
  canEditRole: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<EmploymentStatus | null>(
    null,
  );

  function run(action: () => Promise<unknown>, okMessage: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await action();
        setSuccess(okMessage);
        setConfirmStatus(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {canManageLifecycle ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--aster-ink)]">
            Cycle de vie — statut actuel : {employmentStatus}
          </p>
          <div className="flex flex-wrap gap-2">
            {(["actif", "inactif", "parti"] as EmploymentStatus[]).map(
              (status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={status === employmentStatus ? "default" : "outline"}
                  disabled={pending || status === employmentStatus}
                  onClick={() => setConfirmStatus(status)}
                >
                  Passer à {status}
                </Button>
              ),
            )}
          </div>
          {confirmStatus ? (
            <form
              className="space-y-3 rounded-[10px] border border-[var(--aster-warning)]/40 bg-[var(--aster-warning-bg)]/40 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const confirmed = form.get("confirm") === "oui";
                if (!confirmed) {
                  setError('Saisissez « oui » pour confirmer.');
                  return;
                }
                run(
                  () =>
                    changeEmploymentStatusAction(employeeId, confirmStatus, {
                      departureDate:
                        String(form.get("departureDate") ?? "") || undefined,
                      departureNote:
                        String(form.get("departureNote") ?? "") || undefined,
                    }),
                  "Statut d'emploi mis à jour.",
                );
              }}
            >
              <p className="text-sm text-[var(--aster-ink)]">
                Confirmer le passage à <strong>{confirmStatus}</strong> ?
                L&apos;accès au compte sera désactivé hors statut actif.
              </p>
              {confirmStatus === "parti" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="departureDate">Date de départ</Label>
                    <Input id="departureDate" name="departureDate" type="date" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="departureNote">Motif / note</Label>
                    <Input id="departureNote" name="departureNote" />
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmation (tapez oui)</Label>
                <Input id="confirm" name="confirm" required />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  Confirmer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmStatus(null)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {canEditRole && currentRole ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const role = String(form.get("role") ?? "") as DemoRole;
            run(
              () => changeAccountRoleAction(employeeId, role),
              "Rôle applicatif mis à jour.",
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="role">Rôle applicatif</Label>
            <select
              id="role"
              name="role"
              className={selectClassName}
              defaultValue={currentRole}
            >
              <option value="collaborateur">Collaborateur</option>
              {canAssignPrivilegedRoles ? (
                <>
                  <option value="admin_rh">Ressources humaines</option>
                  <option value="chef_de_projet">Chef de projet</option>
                </>
              ) : null}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Enregistrer le rôle
          </Button>
        </form>
      ) : null}

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
    </div>
  );
}
