export default function AppLoading() {
  return (
    <div className="aster-page space-y-4 px-4 py-8 sm:px-6 lg:px-8" aria-busy>
      <div className="h-8 w-48 animate-pulse rounded bg-[var(--aster-border)]/70" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[var(--aster-border)]/50" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-[var(--aster-border)]/40" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--aster-border)]/40" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--aster-border)]/40" />
      </div>
      <p className="sr-only">Chargement…</p>
    </div>
  );
}
