"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DemoRole } from "@/domain/types/hr";
import { navigationForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav({ role }: { role: DemoRole }) {
  const pathname = usePathname();
  const primary = navigationForRole(role).filter((item) =>
    [
      "/tableau-de-bord",
      "/conges",
      "/teletravail",
      "/calendrier",
      "/annuaire",
      "/notifications",
    ].includes(item.href),
  );

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--aster-border)] bg-white px-3 py-2 lg:hidden">
      {primary.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium",
              active
                ? "bg-[var(--aster-navy)] text-white"
                : "bg-[var(--aster-surface-2)] text-[var(--aster-ink)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/parametres"
        className="shrink-0 rounded-md bg-[var(--aster-surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--aster-ink)]"
      >
        Plus…
      </Link>
    </nav>
  );
}
