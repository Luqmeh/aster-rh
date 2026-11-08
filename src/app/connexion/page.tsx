import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";
import { resolveAuthFeatureFlags } from "@/infrastructure/auth/types";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/tableau-de-bord");
  }

  const params = await searchParams;
  const flags = resolveAuthFeatureFlags();
  const entraMessage =
    params.error === "entra_disabled"
      ? "Microsoft Entra ID n'est pas encore configuré par l'équipe IT."
      : params.error === "session"
        ? "Session invalide ou compte incomplet. Reconnectez-vous."
        : undefined;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--aster-workspace)] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(15,76,129,0.12),_transparent_55%),linear-gradient(180deg,#f7f5f1_0%,#eef2f6_100%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--aster-ink)]">
            ASTER
          </p>
          <p className="mt-2 text-sm text-[var(--aster-muted)]">
            Espace RH sécurisé — authentification requise
          </p>
        </div>
        <LoginForm
          credentialsEnabled={flags.credentialsEnabled}
          entraEnabled={flags.entraEnabled}
          callbackUrl={params.callbackUrl ?? "/tableau-de-bord"}
          initialError={entraMessage}
        />
      </div>
    </div>
  );
}
