"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DemoRole } from "@/domain/types/hr";
import { navigationGroupsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({ role }: { role: DemoRole }) {
  const pathname = usePathname();
  const groups = navigationGroupsForRole(role);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--aster-border)] bg-[var(--aster-navy)] text-white transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[264px]",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-white/10",
          collapsed ? "justify-center px-2 py-4" : "px-4 py-4",
        )}
      >
        <Link href="/tableau-de-bord" className="min-w-0">
          {collapsed ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold tracking-wide">
              A
            </span>
          ) : (
            <span className="block">
              <span className="block text-lg font-semibold tracking-[0.04em]">
                ASTER
              </span>
              <span className="mt-0.5 block text-[11px] text-white/55">
                Human Resources, connected.
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.id} className="mb-4">
            {!collapsed ? (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
                {group.label}
              </p>
            ) : (
              <div className="mb-1.5 h-px bg-white/10" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-white/15 text-white"
                          : "text-white/70 hover:bg-white/[0.08] hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" />
                      {!collapsed ? (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.planned ? (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/55">
                              bientôt
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-white/60 hover:bg-white/[0.08] hover:text-white",
            collapsed && "justify-center",
          )}
          aria-label={collapsed ? "Développer le menu" : "Réduire le menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Réduire</span>
            </>
          )}
        </button>
        {!collapsed ? (
          <p className="mt-1 px-2 pb-1 text-[10px] text-white/35">
            Prototype démo — PKF Arsilon
          </p>
        ) : null}
      </div>
    </aside>
  );
}
