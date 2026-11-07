import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuickAction({
  href,
  icon: Icon,
  label,
  description,
  className,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-[10px] border border-[var(--aster-border)] bg-white px-3.5 py-3 transition-colors hover:border-[var(--aster-accent)]/40 hover:bg-[var(--aster-accent-bg)]/40",
        className,
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--aster-surface-2)] text-[var(--aster-accent)] group-hover:bg-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--aster-ink)]">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs text-[var(--aster-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
