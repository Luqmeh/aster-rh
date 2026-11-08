import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createRecruitmentService } from "@/application/services/recruitment-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  canDecideRecruitment,
  canManageRecruitment,
  canViewAllRecruitment,
} from "@/domain/rules/permissions";
import { recruitmentStatusLabel } from "@/domain/rules/recruitment";
import { getContainer } from "@/infrastructure/container";
import { formatDateTimeFr } from "@/lib/utils";

export default async function EntretiensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; vue?: string }>;
}) {
  const params = await searchParams;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");

  const service = createRecruitmentService(container);
  const canManage = canManageRecruitment(session.role);
  const canDecide = canDecideRecruitment(session.role);
  const canViewAll = canViewAllRecruitment(session.role);

  const vue =
    params.vue === "revue" || params.vue === "historique" || params.vue === "missions"
      ? params.vue
      : canDecide
        ? "revue"
        : "tous";

  const statusFilter =
    vue === "revue"
      ? ("soumis_revue" as const)
      : vue === "historique"
        ? ([
            "approuve",
            "refuse",
            "intervieweur_assigne",
            "entretien_planifie",
            "entretien_termine",
          ] as const)
        : params.status
          ? (params.status as never)
          : undefined;

  const candidates = await service.listVisible(session, {
    q: params.q,
    status: statusFilter as never,
  });

  const title = canDecide
    ? "Recrutement — revue Chef de projet"
    : canManage
      ? "Recrutement — dossiers RH"
      : "Mes entretiens assignés";

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title={title}
        description="Workflow de recrutement externe : dossiers candidats, CV privés, décisions et assignation d'intervieweurs."
        actions={
          canManage ? (
            <Button asChild size="sm">
              <Link href="/entretiens/nouveau">Nouveau dossier</Link>
            </Button>
          ) : null
        }
      />

      {canViewAll ? (
        <div className="flex flex-wrap gap-2">
          {canDecide ? (
            <>
              <Button asChild size="sm" variant={vue === "revue" ? "default" : "secondary"}>
                <Link href="/entretiens?vue=revue">À revoir</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={vue === "historique" ? "default" : "secondary"}
              >
                <Link href="/entretiens?vue=historique">Historique entretiens</Link>
              </Button>
            </>
          ) : null}
          <Button asChild size="sm" variant={vue === "tous" ? "default" : "secondary"}>
            <Link href="/entretiens">Tous les dossiers</Link>
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          <form className="flex flex-wrap gap-3">
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Candidat, poste, e-mail…"
              className="max-w-md"
            />
            {vue ? <input type="hidden" name="vue" value={vue} /> : null}
            <Button type="submit" size="sm" variant="secondary">
              Rechercher
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {candidates.length} dossier{candidates.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidates.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Aucun dossier"
              description="Les dossiers visibles selon votre rôle apparaîtront ici."
            />
          ) : (
            candidates.map((c) => (
              <Link
                key={c.id}
                href={`/entretiens/${c.id}`}
                className="flex flex-col gap-2 rounded-[10px] border border-[var(--aster-border)] px-3 py-3 transition-colors hover:bg-[var(--aster-surface-2)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--aster-ink)]">
                    {c.fullName}
                  </p>
                  <p className="text-xs text-[var(--aster-muted)]">
                    {c.positionTitle}
                    {c.assignedAt
                      ? ` · assigné ${formatDateTimeFr(c.assignedAt)}`
                      : c.submittedAt
                        ? ` · soumis ${formatDateTimeFr(c.submittedAt)}`
                        : ""}
                  </p>
                </div>
                <Badge variant="outline">{recruitmentStatusLabel(c.status)}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
