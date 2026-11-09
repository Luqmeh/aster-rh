import Link from "next/link";
import { redirect } from "next/navigation";
import { createWorkAbsenceService } from "@/application/services/work-absence-service";
import {
  canManageWorkAbsences,
  canViewAllWorkAbsences,
} from "@/domain/rules/permissions";
import {
  workAbsenceCategoryLabel,
  workAbsenceStatusLabel,
} from "@/domain/rules/work-absence";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr, fullName } from "@/lib/utils";

const TABS = [
  { id: "nouvelles", label: "Nouvelles déclarations" },
  { id: "documents_manquants", label: "Documents manquants" },
  { id: "en_cours", label: "Arrêts en cours" },
  { id: "prolongations", label: "Prolongations" },
  { id: "speciaux", label: "Congés spéciaux" },
  { id: "historique", label: "Historique" },
] as const;

export default async function AdminAbsencesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canViewAllWorkAbsences(session.role)) {
    redirect("/tableau-de-bord");
  }

  const params = await searchParams;
  const tab = params.tab ?? "nouvelles";
  const service = createWorkAbsenceService({
    hr: container.hr,
    email: container.email,
    storage: container.storage,
  });
  const rows = await service.listVisible(session, {
    tab: tab === "historique" ? undefined : tab,
  });
  const employees = await container.hr.listEmployees({ includeInactive: true });
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const canManage = canManageWorkAbsences(session.role);

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Gestion des arrêts et absences spéciales"
        description={
          canManage
            ? "Traitement RH des déclarations, justificatifs et visites de reprise."
            : "Vue opérationnelle Chef de projet — sans accès aux justificatifs médicaux."
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/administration/absences?tab=${t.id}`}
            className={`rounded-full px-3 py-1.5 text-[12px] ${
              tab === t.id
                ? "bg-[var(--aster-navy)] text-white"
                : "bg-white text-[var(--aster-muted)] ring-1 ring-[var(--aster-border)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {TABS.find((t) => t.id === tab)?.label ?? "Dossiers"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <EmptyState
              title="Aucun dossier"
              description="Aucun élément pour ce filtre."
            />
          ) : (
            rows.map((item) => {
              const emp = byId[item.employeeId];
              return (
                <Link
                  key={item.id}
                  href={`/administration/absences/${item.id}`}
                  className="block rounded-lg border border-[var(--aster-border)] p-3 hover:bg-[var(--aster-workspace)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {emp
                          ? fullName(emp.firstName, emp.lastName)
                          : item.employeeId}{" "}
                        — {workAbsenceCategoryLabel(item.category)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--aster-muted)]">
                        {formatDateFr(item.startDate)} →{" "}
                        {formatDateFr(item.endDate)}
                        {item.payrollProcessingMonth
                          ? ` · Paie cible ${item.payrollProcessingMonth}`
                          : ""}
                        {item.returnVisitRequired
                          ? " · Visite reprise à suivre"
                          : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {workAbsenceStatusLabel(item.status)}
                    </Badge>
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
