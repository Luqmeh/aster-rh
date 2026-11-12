import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createDocumentRequestService } from "@/application/services/document-request-service";
import {
  DocumentDownloadButton,
  HrDocumentRequestActions,
} from "@/components/modules/document-request-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  documentRequestStatusLabel,
  documentRequestTypeLabel,
} from "@/domain/rules/document-requests";
import {
  canProcessDocumentRequests,
  canViewAllDocumentRequests,
} from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";
import { formatDateTimeFr, fullName } from "@/lib/utils";

export default async function AdministrationDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canViewAllDocumentRequests(session.role)) {
    redirect("/tableau-de-bord");
  }

  const service = createDocumentRequestService(container);
  let request;
  try {
    request = await service.getVisible(session, id);
  } catch {
    notFound();
  }

  const [employee, events] = await Promise.all([
    container.hr.getEmployee(request.employeeId),
    container.hr.listDocumentRequestEvents(request.id),
  ]);
  const canProcess = canProcessDocumentRequests(session.role);

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title={
          request.customLabel ||
          documentRequestTypeLabel(request.documentType)
        }
        description={
          employee
            ? `Demande de ${fullName(employee.firstName, employee.lastName)}`
            : "Demande documentaire"
        }
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/administration/documents">Retour à la file</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Détail collaborateur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-[var(--aster-muted)]">Statut : </span>
              <Badge variant="outline">
                {documentRequestStatusLabel(request.status)}
              </Badge>
            </p>
            <p>
              <span className="text-[var(--aster-muted)]">Soumise le : </span>
              {formatDateTimeFr(request.createdAt)}
            </p>
            <p>
              <span className="text-[var(--aster-muted)]">Motif / usage : </span>
              {request.reason}
            </p>
            {request.hrMessage ? (
              <p>
                <span className="text-[var(--aster-muted)]">
                  Message collaborateur :{" "}
                </span>
                {request.hrMessage}
              </p>
            ) : null}
            {request.fileName ? (
              <div className="space-y-2">
                <p>
                  <span className="text-[var(--aster-muted)]">Fichier : </span>
                  {request.fileName}
                  {request.published ? " (publié)" : " (non publié)"}
                </p>
                <DocumentDownloadButton
                  requestId={request.id}
                  fileName={request.fileName}
                />
              </div>
            ) : (
              <p className="text-[var(--aster-muted)]">Aucun fichier déposé.</p>
            )}
          </CardContent>
        </Card>

        {canProcess ? (
          <Card>
            <CardHeader>
              <CardTitle>Actions RH</CardTitle>
            </CardHeader>
            <CardContent>
              <HrDocumentRequestActions request={request} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des changements</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--aster-muted)]">Aucun événement.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="border-b border-[var(--aster-border)]/70 pb-2 last:border-0"
                >
                  <span className="font-medium">{e.kind}</span>
                  <span className="text-[var(--aster-muted)]">
                    {" "}
                    · {formatDateTimeFr(e.createdAt)}
                  </span>
                  <p className="text-[var(--aster-muted)]">{e.message}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
