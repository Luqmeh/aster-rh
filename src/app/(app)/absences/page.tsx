import Link from "next/link";
import { createWorkAbsenceService } from "@/application/services/work-absence-service";
import {
  workAbsenceCategoryLabel,
  workAbsenceStatusLabel,
} from "@/domain/rules/work-absence";
import { WorkAbsenceForm } from "@/components/modules/work-absence-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  canSubmitWorkAbsence,
  canViewAllWorkAbsences,
} from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr } from "@/lib/utils";

export default async function AbsencesPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");

  const canSubmitSelf = canSubmitWorkAbsence(session.role);
  const canViewAll = canViewAllWorkAbsences(session.role);
  const service = createWorkAbsenceService({
    hr: container.hr,
    email: container.email,
    storage: container.storage,
  });
  const reminders = service.reminders();
  const mine = await service.listVisible(session);
  const parentOptions = mine
    .filter(
      (a) =>
        a.family === "arret" &&
        a.category !== "prolongation_arret" &&
        (!canViewAll || a.employeeId === session.employee.id),
    )
    .map((a) => ({
      id: a.id,
      label: `${workAbsenceCategoryLabel(a.category)} · ${a.startDate} → ${a.endDate}`,
    }));

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Arrêts & absences spéciales"
        description={
          canSubmitSelf
            ? "Déclaration d’absence : dates, catégorie et commentaire. Justificatifs médicaux réservés RH."
            : "Suivi des arrêts et absences spéciales — déclaration personnelle réservée aux collaborateurs. Traitement RH dans Administration."
        }
      />

      <div className="rounded-xl border border-[var(--aster-border)] bg-white p-4 text-[13px] text-[var(--aster-muted)] shadow-sm">
        <p>{reminders.notify24h}</p>
        <p className="mt-1">{reminders.docs48h}</p>
        <p className="mt-1">{reminders.payrollCutoff}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {canSubmitSelf ? (
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle déclaration</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkAbsenceForm parentOptions={parentOptions} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Libre-service absences</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Réservé aux collaborateurs"
                description="Les comptes management consultent et administrent les absences sans déposer de déclaration personnelle."
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{canViewAll ? "Absences visibles" : "Historique"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mine.length === 0 ? (
              <EmptyState
                title="Aucune déclaration"
                description="Vos arrêts et congés spéciaux apparaîtront ici."
              />
            ) : (
              mine.map((item) => (
                <Link
                  key={item.id}
                  href={`/absences/${item.id}`}
                  className="block rounded-lg border border-[var(--aster-border)] p-3 transition hover:bg-[var(--aster-workspace)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--aster-ink)]">
                        {workAbsenceCategoryLabel(item.category)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--aster-muted)]">
                        {formatDateFr(item.startDate)} →{" "}
                        {formatDateFr(item.endDate)} · {item.daysCount} j
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {workAbsenceStatusLabel(item.status)}
                    </Badge>
                  </div>
                  {!item.documentsReceived ? (
                    <p className="mt-2 text-[11px] text-amber-800">
                      Justificatif en attente
                    </p>
                  ) : null}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
