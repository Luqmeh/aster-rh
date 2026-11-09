import Link from "next/link";
import { notFound } from "next/navigation";
import { createWorkAbsenceService } from "@/application/services/work-absence-service";
import {
  administrativeNotesForCategory,
  workAbsenceCategoryLabel,
  workAbsenceStatusLabel,
} from "@/domain/rules/work-absence";
import { WorkAbsenceUpload } from "@/components/modules/work-absence-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr } from "@/lib/utils";
import { AuthError } from "@/infrastructure/auth/authorization";

export default async function AbsenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");

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
  const notes = administrativeNotesForCategory(absence.category);

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title={workAbsenceCategoryLabel(absence.category)}
        description={`${formatDateFr(absence.startDate)} → ${formatDateFr(absence.endDate)}`}
        actions={
          <Link
            href="/absences"
            className="text-[13px] text-[var(--aster-accent)] underline-offset-2 hover:underline"
          >
            Retour
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {workAbsenceStatusLabel(absence.status)}
        </Badge>
        {absence.requiresHrReview ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
            Revue RH signalée
          </span>
        ) : null}
        {absence.dateGapFlag ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
            Écart de dates (prolongation)
          </span>
        ) : null}
        {absence.recurrenceWithin3MonthsFlag ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
            Rechute possible &lt; 3 mois
          </span>
        ) : null}
      </div>

      {notes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations administratives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[13px] text-[var(--aster-muted)]">
            {notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {absence.hrMessage ? (
        <Card>
          <CardContent className="pt-5 text-[13px]">
            <p className="font-medium">Message RH</p>
            <p className="mt-1 text-[var(--aster-muted)]">{absence.hrMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Justificatifs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents.length === 0 ? (
              <p className="text-[13px] text-[var(--aster-muted)]">
                Aucun document déposé — vous pouvez soumettre sans justificatif
                puis le compléter.
              </p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {documents.map((d) => (
                  <li key={d.id} className="rounded border border-[var(--aster-border)] px-3 py-2">
                    {d.fileName}
                    <span className="ml-2 text-[var(--aster-muted)]">
                      ({d.kind})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <WorkAbsenceUpload absenceId={absence.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-[13px]">
              {events.map((e) => (
                <li key={e.id} className="border-b border-[var(--aster-border)] pb-2">
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
    </div>
  );
}
