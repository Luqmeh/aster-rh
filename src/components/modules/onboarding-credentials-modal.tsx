"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatCredentialsForCopy,
  type OnboardingCredentials,
} from "@/lib/onboarding-credentials";

export function OnboardingCredentialsModal({
  open,
  credentials,
  onClose,
}: {
  open: boolean;
  credentials: OnboardingCredentials | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"email" | "password" | "all" | null>(
    null,
  );

  async function copy(text: string, key: "email" | "password" | "all") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Dialog.Root
      open={open && Boolean(credentials)}
      onOpenChange={(next) => {
        if (!next) {
          setCopied(null);
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[var(--aster-border)] bg-white p-5 shadow-lg focus:outline-none"
          onPointerDownOutside={(event) => {
            // Empêche la fermeture accidentelle (timeout / clic hors zone).
            event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold text-[var(--aster-ink)]">
              Compte créé — identifiants temporaires
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--aster-muted)] hover:bg-[var(--aster-surface-2)]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-[var(--aster-muted)]">
            Le mot de passe temporaire n&apos;est affiché qu&apos;une seule
            fois. Transmettez-le de façon sécurisée. Il ne pourra pas être
            récupéré ensuite — utilisez le reprovisionnement si besoin.
          </Dialog.Description>

          {credentials ? (
            <div className="mt-4 space-y-3">
              <CredentialRow
                label="E-mail de connexion"
                value={credentials.email}
                copied={copied === "email"}
                onCopy={() => copy(credentials.email, "email")}
              />
              <CredentialRow
                label="Mot de passe temporaire"
                value={credentials.temporaryPassword}
                mono
                copied={copied === "password"}
                onCopy={() =>
                  copy(credentials.temporaryPassword, "password")
                }
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    copy(formatCredentialsForCopy(credentials), "all")
                  }
                >
                  {copied === "all" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copier e-mail + mot de passe
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" size="sm">
                    J&apos;ai noté les identifiants
                  </Button>
                </Dialog.Close>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CredentialRow({
  label,
  value,
  mono,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--aster-border)] bg-[var(--aster-surface-2)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--aster-muted)]">
          {label}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-xs text-[var(--aster-navy)] hover:underline"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copier
        </button>
      </div>
      <p
        className={`mt-1 break-all text-sm font-medium text-[var(--aster-ink)] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
