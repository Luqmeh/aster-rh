import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createWorkAbsenceService } from "@/application/services/work-absence-service";
import {
  canManageWorkAbsences,
  canViewAllWorkAbsences,
  canViewWorkAbsenceMedicalDocs,
} from "@/domain/rules/permissions";
import {
  absenceDocumentKindLabel,
  administrativeNotesForCategory,
  workAbsenceCategoryLabel,
  workAbsenceStatusLabel,
} from "@/domain/rules/work-absence";
import { AbsenceDocDownloadButton } from "@/components/modules/absence-doc-download-button";
import { WorkAbsenceHrForm } from "@/components/modules/work-absence-hr-form";
import { WorkAbsenceUpload } from "@/components/modules/work-absence-upload";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AuthError } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr, fullName } from "@/lib/utils";

export default async function AdminAbsenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canViewAllWorkAbsences(session.role)) {
    redirect("/tableau-de-bord");
  }

  const service = createWorkAbsenceService({
    hr: container.hr,
    email: container.email,
    storage: container.storage,
  });

  let detail;
  try {
    detail = await service.getVisible(session, id);
  } catch (error) {
    if (error instanceof AuthError && error.status === 404) notFound();
    throw error;
  }

  const { absence, documents, events } = detail;
  const employee = await container.hr.getEmployee(absence.employeeId);
  const canManage = canManageWorkAbsences(session.role);
  const canDocs = canViewWorkAbsenceMedicalDocs(session.role);
  const notes = administrativeNotesForCategory(absence.category);

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title={workAbsenceCategoryLabel(absence.category)}
        description={
          employee
            ? fullName(employee.firstName, employee.lastName)
            : absence.employeeId
        }
        actions={
          <Link
            href="/administration/absences"
            className="text-[13px] text-[var(--aster-accent)] underline-offset-2 hover:underline"
          >
            Retour liste
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {workAbsenceStatusLabel(absence.status)}
        </Badge>
        {absence.requiresHrReview ? (
          <Badge variant="warning">Revue RH</Badge>
        ) : null}
        {absence.dateGapFlag ? (
          <Badge variant="warning">Écart prolongation</Badge>
        ) : null}
        {absence.recurrenceWithin3MonthsFlag ? (
          <Badge variant="warning">Rechute &lt; 3 mois</Badge>
        ) : null}
        {absence.payrollProcessingMonth ? (
          <Badge variant="secondary">
            Paie cible {absence.payrollProcessingMonth}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Info
          label="Période"
          value={`${formatDateFr(absence.startDate)} → ${formatDateFr(absence.endDate)}`}
        />
        <Info label="Durée" value={`${absence.daysCount} j`} />
        <Info
          label="Retour prévu"
          value={
            absence.expectedReturnDate
              ? formatDateFr(absence.expectedReturnDate)
              : "—"
          }
        />
      </div>

      {notes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rappels guide (non automatisés)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[13px] text-[var(--aster-muted)]">
            {notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Traitement RH</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkAbsenceHrForm absence={absence} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-5 text-[13px] text-[var(--aster-muted)]">
              Vue Chef de projet : statut opérationnel uniquement. Les
              certificats médicaux restent réservés aux Ressources humaines.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Justificatifs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canDocs ? (
              <p className="text-[13px] text-[var(--aster-muted)]">
                Accès documents médicaux non autorisé pour votre rôle.
              </p>
            ) : documents.length === 0 ? (
              <p className="text-[13px] text-[var(--aster-muted)]">
                Aucun justificatif.
              </p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded border border-[var(--aster-border)] px-3 py-2"
                  >
                    <span>
                      {d.fileName}
                      <span className="ml-2 text-[var(--aster-muted)]">
                        {absenceDocumentKindLabel(d.kind)}
                      </span>
                    </span>
                    <AbsenceDocDownloadButton
                      absenceId={absence.id}
                      documentId={d.id}
                    />
                  </li>
                ))}
              </ul>
            )}
            {canManage ? <WorkAbsenceUpload absenceId={absence.id} /> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-[13px]">
            {events.map((e) => (
              <li
                key={e.id}
                className="border-b border-[var(--aster-border)] pb-2"
              >
                <p>{e.message}</p>
                <p className="text-[11px] text-[var(--aster-muted)]">
                  {e.createdAt}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--aster-border)] bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-[var(--aster-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
