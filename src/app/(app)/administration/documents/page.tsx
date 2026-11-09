import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";
import { createDocumentRequestService } from "@/application/services/document-request-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  DOCUMENT_REQUEST_TYPES,
  documentRequestStatusLabel,
  documentRequestTypeLabel,
} from "@/domain/rules/document-requests";
import {
  canProcessDocumentRequests,
  canViewAllDocumentRequests,
} from "@/domain/rules/permissions";
import type {
  DocumentRequestStatus,
  DocumentRequestType,
} from "@/domain/types/hr";
import { getContainer } from "@/infrastructure/container";
import { formatDateTimeFr, fullName } from "@/lib/utils";

const QUEUE_STATUSES: DocumentRequestStatus[] = [
  "en_attente",
  "en_traitement",
  "informations_demandees",
];

export default async function AdministrationDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    vue?: string;
  }>;
}) {
  const params = await searchParams;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canViewAllDocumentRequests(session.role)) {
    redirect("/tableau-de-bord");
  }

  const vue =
    params.vue === "historique" || params.vue === "file"
      ? params.vue
      : "file";

  const statusFilter =
    params.status &&
    [
      "en_attente",
      "en_traitement",
      "informations_demandees",
      "document_disponible",
      "refusee",
    ].includes(params.status)
      ? (params.status as DocumentRequestStatus)
      : vue === "file"
        ? QUEUE_STATUSES
        : (["document_disponible", "refusee"] as DocumentRequestStatus[]);

  const typeFilter =
    params.type && DOCUMENT_REQUEST_TYPES.includes(params.type as DocumentRequestType)
      ? (params.type as DocumentRequestType)
      : undefined;

  const service = createDocumentRequestService(container);
  const [requests, employees] = await Promise.all([
    service.listForHr(session, {
      status: statusFilter,
      documentType: typeFilter,
      q: params.q,
    }),
    container.hr.listEmployees({ includeInactive: true }),
  ]);
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const canProcess = canProcessDocumentRequests(session.role);

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Demandes de documents"
        description={
          canProcess
            ? "File de travail RH — traiter, clarifier, déposer et publier les pièces collaborateur."
            : "Consultation des demandes documentaires."
        }
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/administration">Retour administration</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={vue === "file" ? "default" : "secondary"}>
          <Link href="/administration/documents?vue=file">File active</Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant={vue === "historique" ? "default" : "secondary"}
        >
          <Link href="/administration/documents?vue=historique">Historique</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3" method="get">
            <input type="hidden" name="vue" value={vue} />
            <Input
              name="q"
              placeholder="Rechercher un collaborateur…"
              defaultValue={params.q ?? ""}
              className="max-w-xs"
            />
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="flex h-9 rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 text-sm"
            >
              <option value="">Tous les statuts (vue)</option>
              <option value="en_attente">En attente</option>
              <option value="en_traitement">En traitement</option>
              <option value="informations_demandees">Informations demandées</option>
              <option value="document_disponible">Document disponible</option>
              <option value="refusee">Refusée</option>
            </select>
            <select
              name="type"
              defaultValue={params.type ?? ""}
              className="flex h-9 rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 text-sm"
            >
              <option value="">Tous les types</option>
              {DOCUMENT_REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {documentRequestTypeLabel(t)}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Filtrer
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {vue === "file" ? "File de travail" : "Historique"} ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Aucune demande"
              description="La file est vide pour ces filtres."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-[var(--aster-border)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--aster-muted)]">
                  <tr>
                    <th className="px-2 py-2.5">Collaborateur</th>
                    <th className="px-2 py-2.5">Document</th>
                    <th className="px-2 py-2.5">Statut</th>
                    <th className="px-2 py-2.5">Soumise</th>
                    <th className="px-2 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const emp = byId[r.employeeId];
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-[var(--aster-border)]/70 last:border-0"
                      >
                        <td className="px-2 py-3 font-medium">
                          {emp
                            ? fullName(emp.firstName, emp.lastName)
                            : r.employeeId}
                        </td>
                        <td className="px-2 py-3">
                          {r.customLabel ||
                            documentRequestTypeLabel(r.documentType)}
                        </td>
                        <td className="px-2 py-3">
                          <Badge variant="outline">
                            {documentRequestStatusLabel(r.status)}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 text-[var(--aster-muted)]">
                          {formatDateTimeFr(r.createdAt)}
                        </td>
                        <td className="px-2 py-3">
                          <Link
                            href={`/administration/documents/${r.id}`}
                            className="text-sm font-medium text-[var(--aster-accent)] hover:underline"
                          >
                            Ouvrir
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
