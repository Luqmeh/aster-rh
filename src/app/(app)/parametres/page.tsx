import { resetDemoDataAction } from "@/app/actions/demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { roleLabel } from "@/domain/rules/approvals";
import { resolveAuthFeatureFlags } from "@/infrastructure/auth/types";
import { getContainer } from "@/infrastructure/container";

export default async function ParametresPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  const flags = resolveAuthFeatureFlags();

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Paramètres"
        description="Compte authentifié et options d’environnement."
        actions={
          <Badge variant={container.persistence === "prisma" ? "accent" : "outline"}>
            Persistance : {container.persistence === "prisma" ? "PostgreSQL" : "mémoire"}
          </Badge>
        }
      />

      {reset === "ok" ? (
        <div
          role="status"
          className="rounded-[10px] border border-[var(--aster-success)]/25 bg-[var(--aster-success-bg)] px-4 py-3 text-sm text-[var(--aster-success)]"
        >
          Données de démonstration ASTER réinitialisées avec succès
          {container.persistence === "prisma"
            ? " (PostgreSQL)."
            : " (magasin mémoire)."}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compte connecté</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--aster-muted)]">
            <p>
              {session.employee.firstName} {session.employee.lastName} —{" "}
              {roleLabel(session.role)}
            </p>
            <p>E-mail : {session.email}</p>
            <p>
              Fournisseur :{" "}
              {session.authProvider === "entra_id"
                ? "Microsoft Entra ID"
                : "Identifiants temporaires"}
            </p>
            <p>
              Credentials : {flags.credentialsEnabled ? "activés" : "désactivés"} ·
              Entra : {flags.entraEnabled ? "activé" : "non configuré"}
            </p>
          </CardContent>
        </Card>

        {session.role === "admin_rh" && session.isDemoMode ? (
          <Card>
            <CardHeader>
              <CardTitle>Données de démonstration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[var(--aster-muted)]">
                Réinitialise uniquement les données ASTER de démo (congés,
                télétravail, notifications, documents seed). Réservé à{" "}
                <code>ASTER_MODE=demo</code> et au rôle RH.
              </p>
              <form action={resetDemoDataAction}>
                <Button type="submit" variant="outline">
                  Réinitialiser les données démo
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--aster-muted)]">
          <p>
            Identifiants temporaires (prototype) — désactivables via{" "}
            <code>ASTER_CREDENTIALS_AUTH=0</code>.
          </p>
          <p>
            Microsoft Entra ID — voir <code>docs/SSO_HANDOVER.md</code>. Activer
            avec <code>ASTER_ENTRA_AUTH=1</code> et les variables{" "}
            <code>AUTH_MICROSOFT_ENTRA_ID_*</code>.
          </p>
          <p>
            Persistance —{" "}
            {container.persistence === "prisma"
              ? "Prisma / PostgreSQL actif."
              : "magasin mémoire local."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
