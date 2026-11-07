import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact
          ? "gap-1.5 py-4"
          : "gap-3 rounded-[10px] border border-dashed border-[var(--aster-border-strong)] bg-[var(--aster-workspace)] px-6 py-12",
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-white text-[var(--aster-accent)] shadow-[var(--aster-shadow)]",
            compact ? "h-8 w-8" : "h-10 w-10",
          )}
        >
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </div>
      ) : null}
      <div>
        <p className="text-sm font-semibold text-[var(--aster-ink)]">{title}</p>
        <p
          className={cn(
            "text-sm text-[var(--aster-muted)]",
            compact ? "mt-0.5" : "mt-1 max-w-sm",
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
