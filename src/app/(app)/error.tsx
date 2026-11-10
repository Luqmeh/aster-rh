"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ASTER]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="aster-page mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-[var(--aster-ink)]">
        Une erreur est survenue
      </h1>
      <p className="text-sm text-[var(--aster-muted)]">
        L&apos;opération n&apos;a pas pu aboutir. Réessayez ou revenez au
        tableau de bord.
      </p>
      <div className="flex justify-center gap-2">
        <Button type="button" onClick={reset}>
          Réessayer
        </Button>
        <Button type="button" variant="secondary" asChild>
          <a href="/tableau-de-bord">Tableau de bord</a>
        </Button>
      </div>
    </div>
  );
}
