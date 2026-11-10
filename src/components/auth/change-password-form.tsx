"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/actions/password-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Mot de passe temporaire actuel</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pending}
        />
        <p className="text-xs text-[var(--aster-muted)]">
          Au moins 10 caractères, avec une lettre et un chiffre.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pending}
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-[var(--aster-danger)]">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enregistrement…" : "Enregistrer et continuer"}
      </Button>
    </form>
  );
}
