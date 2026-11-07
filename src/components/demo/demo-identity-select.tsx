"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchDemoIdentityAction } from "@/app/actions/demo";
import { roleLabel } from "@/domain/rules/approvals";
import type { DemoIdentity } from "@/domain/types/hr";

export function DemoIdentitySelect({
  identities,
  currentId,
}: {
  identities: DemoIdentity[];
  currentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-xs text-[var(--aster-muted)]">
      <span className="hidden lg:inline">Identité démo</span>
      <select
        className="h-9 max-w-[220px] rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-2 text-sm text-[var(--aster-ink)]"
        value={currentId}
        disabled={pending}
        aria-label="Changer d'identité de démonstration"
        onChange={(event) => {
          const identityId = event.target.value;
          startTransition(async () => {
            await switchDemoIdentityAction(identityId);
            router.refresh();
          });
        }}
      >
        {identities.map((identity) => (
          <option key={identity.id} value={identity.id}>
            {identity.label} — {roleLabel(identity.role)}
          </option>
        ))}
      </select>
    </label>
  );
}
