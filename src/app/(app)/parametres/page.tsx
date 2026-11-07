import { resetDemoDataAction } from "@/app/actions/demo";
import { RoleSwitcher } from "@/components/demo/role-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
  const identities = await container.auth.listDemoIdentities();

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Paramètres"
        description="Contrôles de démonstration uniquement — pas de configuration de production."
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
        <RoleSwitcher
          identities={identities}
          currentId={session.identity.id}
          currentRole={session.role}
        />

        <Card>
          <CardHeader>
            <CardTitle>Données de démonstration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--aster-muted)]">
              Réinitialise uniquement les données ASTER de démo (congés,
              télétravail, notifications, documents seed) — pas une base
              générale. Réservé à <code>ASTER_MODE=demo</code>.
            </p>
            <form action={resetDemoDataAction}>
              <Button type="submit" variant="outline">
                Réinitialiser les données démo
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intégrations (préparées)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--aster-muted)]">
          <p>
            Microsoft Entra ID SSO — adaptateur non branché (voir
            docs/INTEGRATIONS.md).
          </p>
          <p>E-mail — mock (journal console).</p>
          <p>Stockage documents — mock (URLs factices).</p>
          <p>Paie — frontière documentée, non implémentée.</p>
          <p>
            Persistance — {container.persistence === "prisma"
              ? "Prisma / PostgreSQL actif."
              : "magasin mémoire local (définir DATABASE_URL pour PostgreSQL)."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
