import { FlaskConical } from "lucide-react";
import { DEMO_DISCLAIMER } from "@/data/demo-seed";

export function DemoBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--aster-border)] bg-[var(--aster-surface-2)] px-4 py-1.5 text-[11px] text-[var(--aster-muted)] sm:text-xs">
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-[var(--aster-accent)]" />
      <p className="leading-snug">
        <span className="font-semibold text-[var(--aster-ink)]">
          Mode démonstration
        </span>
        {" — "}
        {DEMO_DISCLAIMER} Authentification fictive, non productive.
      </p>
    </div>
  );
}
