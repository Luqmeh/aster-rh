"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchDemoIdentityAction } from "@/app/actions/demo";
import type { DemoIdentity } from "@/domain/types/hr";
import { cn } from "@/lib/utils";

export function MobileRoleBar({
  identities,
  currentId,
}: {
  identities: DemoIdentity[];
  currentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-[var(--aster-border)] bg-white px-3 py-2 md:hidden">
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
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
              active
                ? "bg-[var(--aster-navy)] text-white"
                : "bg-[var(--aster-surface-2)] text-[var(--aster-ink)]",
            )}
          >
            {identity.label}
          </button>
        );
      })}
    </div>
  );
}
