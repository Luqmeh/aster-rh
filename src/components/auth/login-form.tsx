"use client";

import { useActionState } from "react";
import { entraSignInAction, loginAction, type LoginState } from "@/app/actions/auth";

const initial: LoginState = {};

export function LoginForm({
  credentialsEnabled,
  entraEnabled,
  callbackUrl,
  initialError,
}: {
  credentialsEnabled: boolean;
  entraEnabled: boolean;
  callbackUrl: string;
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const error = state.error ?? initialError;

  return (
    <div className="rounded-[14px] border border-[var(--aster-border)] bg-white p-6 shadow-[0_20px_50px_rgba(15,30,50,0.08)] sm:p-8">
      {credentialsEnabled ? (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-[var(--aster-ink)]"
            >
              E-mail professionnel
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-[10px] border border-[var(--aster-border)] bg-[var(--aster-surface)] px-3 py-2.5 text-sm outline-none ring-[var(--aster-accent)] focus:ring-2"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-[var(--aster-ink)]"
            >
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-[10px] border border-[var(--aster-border)] bg-[var(--aster-surface)] px-3 py-2.5 text-sm outline-none ring-[var(--aster-accent)] focus:ring-2"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--aster-danger)]">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center rounded-[10px] bg-[var(--aster-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
          >
            {pending ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--aster-muted)]">
          La connexion par identifiants temporaires est désactivée.
        </p>
      )}

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--aster-border)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--aster-muted)]">
          ou
        </span>
        <div className="h-px flex-1 bg-[var(--aster-border)]" />
      </div>

      {entraEnabled ? (
        <form action={entraSignInAction}>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-[10px] border border-[var(--aster-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--aster-ink)] hover:bg-[var(--aster-surface-2)]"
          >
            Continuer avec Microsoft
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled
          title="Nécessite la configuration Microsoft Entra ID par l'équipe IT"
          className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-[10px] border border-dashed border-[var(--aster-border)] bg-[var(--aster-surface)] px-4 py-2.5 text-sm font-medium text-[var(--aster-muted)]"
        >
          Microsoft — configuration IT requise
        </button>
      )}
    </div>
  );
}
