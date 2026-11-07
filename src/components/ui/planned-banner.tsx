import { Construction } from "lucide-react";

/** Distingue clairement les modules planifiés des fonctionnalités opérationnelles. */
export function PlannedBanner({
  moduleName,
  note,
}: {
  moduleName: string;
  note?: string;
}) {
  return (
    <div className="flex gap-3 rounded-[10px] border border-dashed border-[var(--aster-border-strong)] bg-[var(--aster-surface)] px-4 py-3.5 shadow-[var(--aster-shadow)]">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--aster-surface-2)] text-[var(--aster-muted)]">
        <Construction className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--aster-ink)]">
          Module « {moduleName} » — non opérationnel
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-[var(--aster-muted)]">
          {note ??
            "Fonctionnalité planifiée pour les itérations suivantes. Cet écran illustre la navigation cible, sans processus métier complet."}
        </p>
      </div>
    </div>
  );
}
