import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createRecruitmentService } from "@/application/services/recruitment-service";
import {
  CvAccessButton,
  InterviewerAssignForm,
  RecruitmentDecisionForm,
  RecruitmentEditForm,
} from "@/components/modules/recruitment-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  canAssignInterviewer,
  canDecideRecruitment,
  canManageRecruitment,
} from "@/domain/rules/permissions";
import { recruitmentStatusLabel } from "@/domain/rules/recruitment";
import { AuthError } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";
import { formatDateTimeFr } from "@/lib/utils";

export default async function RecrutementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");

  const service = createRecruitmentService(container);
  let payload;
  try {
    payload = await service.get(session, id);
  } catch (error) {
    if (error instanceof AuthError && error.status === 404) notFound();
    redirect("/entretiens");
  }

  const { candidate, events } = payload;
  const [departments, activeEmployees, interviewer] = await Promise.all([
    container.hr.listDepartments(),
    container.hr.listEmployees({ employmentStatus: "actif" }),
    candidate.interviewerEmployeeId
      ? container.hr.getEmployee(candidate.interviewerEmployeeId)
      : Promise.resolve(null),
  ]);

  const canEdit = canManageRecruitment(session.role) && candidate.status === "brouillon";
  const canDecide =
    canDecideRecruitment(session.role) && candidate.status === "soumis_revue";
  const canAssign =
    canAssignInterviewer(session.role) &&
    (candidate.status === "approuve" ||
      candidate.status === "intervieweur_assigne");

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title={candidate.fullName}
        description={`${candidate.positionTitle} · ${recruitmentStatusLabel(candidate.status)}`}
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/entretiens">
              <ArrowLeft className="h-3.5 w-3.5" />
              Liste
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <Badge variant="outline">{recruitmentStatusLabel(candidate.status)}</Badge>
          <Badge variant="secondary">{candidate.email}</Badge>
          {candidate.phone ? <Badge variant="secondary">{candidate.phone}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dossier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Poste" value={candidate.positionTitle} />
            <Field
              label="Notes RH"
              value={candidate.hrNotes || "—"}
            />
            <Field
              label="Décision"
              value={
                candidate.decisionComment
                  ? `${recruitmentStatusLabel(candidate.status)} — ${candidate.decisionComment}`
                  : recruitmentStatusLabel(candidate.status)
              }
            />
            <Field
              label="Intervieweur"
              value={
                interviewer
                  ? `${interviewer.firstName} ${interviewer.lastName} (${interviewer.jobTitle})`
                  : "—"
              }
            />
            <CvAccessButton
              candidateId={candidate.id}
              fileName={candidate.cvFileName}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-[var(--aster-muted)]">Aucun événement.</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[8px] border border-[var(--aster-border)] px-3 py-2 text-sm"
                >
                  <p className="font-medium text-[var(--aster-ink)]">{event.message}</p>
                  <p className="text-xs text-[var(--aster-muted)]">
                    {event.kind} · {formatDateTimeFr(event.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Préparation RH</CardTitle>
          </CardHeader>
          <CardContent>
            <RecruitmentEditForm candidate={candidate} departments={departments} />
          </CardContent>
        </Card>
      ) : null}

      {canDecide ? (
        <Card>
          <CardHeader>
            <CardTitle>Revue Chef de projet</CardTitle>
          </CardHeader>
          <CardContent>
            <RecruitmentDecisionForm candidateId={candidate.id} />
          </CardContent>
        </Card>
      ) : null}

      {canAssign ? (
        <Card>
          <CardHeader>
            <CardTitle>Assignation d&apos;intervieweur</CardTitle>
          </CardHeader>
          <CardContent>
            <InterviewerAssignForm
              candidateId={candidate.id}
              employees={activeEmployees}
              currentInterviewerId={candidate.interviewerEmployeeId}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--aster-muted)]">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--aster-ink)]">{value}</p>
    </div>
  );
}
