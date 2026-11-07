"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { roleLabel } from "@/domain/rules/approvals";
import type { DemoIdentity, DemoRole } from "@/domain/types/hr";
import { switchDemoIdentityAction } from "@/app/actions/demo";
import { cn } from "@/lib/utils";

export function RoleSwitcher({
  identities,
  currentId,
  currentRole,
}: {
  identities: DemoIdentity[];
  currentId: string;
  currentRole: DemoRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-[10px] border border-[var(--aster-border)] bg-white p-3 shadow-[var(--aster-shadow)]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--aster-muted)]">
        Identités de démonstration
      </p>
      <div className="flex flex-col gap-1.5">
        {identities.map((identity) => {
          const active = identity.id === currentId;
          return (
            <button
              key={identity.id}
              type="button"
              disabled={pending || active}
              onClick={() => {
                startTransition(async () => {
                  await switchDemoIdentityAction(identity.id);
                  router.refresh();
                });
              }}
              className={cn(
                "rounded-lg px-3 py-2 text-left transition-colors",
                active
                  ? "bg-[var(--aster-navy)] text-white"
                  : "text-[var(--aster-ink)] hover:bg-[var(--aster-surface-2)]",
              )}
            >
              <span className="block text-sm font-medium">{identity.label}</span>
              <span
                className={cn(
                  "block text-xs",
                  active ? "text-white/75" : "text-[var(--aster-muted)]",
                )}
              >
                {roleLabel(identity.role)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[var(--aster-muted)]">
        Rôle actuel : {roleLabel(currentRole)}. Basculer d&apos;identité simule
        un autre parcours utilisateur.
      </p>
    </div>
  );
}
