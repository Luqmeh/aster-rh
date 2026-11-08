"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { roleLabel } from "@/domain/rules/approvals";
import type { AuthSession } from "@/infrastructure/auth/types";
import { findNavItem } from "@/lib/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { logoutAction } from "@/app/actions/auth";

export function Topbar({
  session,
  unread,
}: {
  session: AuthSession;
  unread: number;
}) {
  const pathname = usePathname();
  const { employee, role } = session;
  const navItem = findNavItem(pathname, role);
  const pageTitle = navItem?.label ?? "ASTER";

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--aster-border)] bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[var(--aster-ink)]">
            {pageTitle}
          </p>
          <p className="hidden truncate text-xs text-[var(--aster-muted)] sm:block">
            {employee.firstName} {employee.lastName} · {roleLabel(role)}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--aster-border)] text-[var(--aster-ink)] hover:bg-[var(--aster-surface-2)]"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--aster-accent)] px-1 text-[10px] font-semibold text-white">
                {unread}
              </span>
            ) : null}
          </Link>
          <UserAvatar initials={employee.avatarInitials} size="sm" />
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--aster-border)] text-[var(--aster-muted)] hover:bg-[var(--aster-surface-2)] hover:text-[var(--aster-ink)]"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
