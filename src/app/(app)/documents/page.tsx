import { FolderOpen, Info } from "lucide-react";
import { createDocumentRequestService } from "@/application/services/document-request-service";
import {
  DocumentDownloadButton,
  EmployeeDocumentRequestForm,
} from "@/components/modules/document-request-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  documentRequestStatusLabel,
  documentRequestTypeLabel,
  listOfferedDocumentTypes,
} from "@/domain/rules/document-requests";
import { canSubmitDocumentRequest } from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";
import { formatDateTimeFr } from "@/lib/utils";

export default async function DocumentsPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");

  const canSubmitSelf = canSubmitDocumentRequest(session.role);
  const service = createDocumentRequestService(container);
  const [requests, library] = await Promise.all([
    canSubmitSelf ? service.listForEmployee(session) : Promise.resolve([]),
    service.listPublishedLibrary(session),
  ]);
  const offeredTypes = listOfferedDocumentTypes(session.employee);
  const pending = requests.filter((r) =>
    ["en_attente", "en_traitement", "informations_demandees"].includes(r.status),
  );
  const history = requests.filter((r) =>
    ["document_disponible", "refusee"].includes(r.status),
  );

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Mes documents"
        description="Consultez les documents mis à disposition, suivez vos demandes et sollicitez une pièce administrative."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[var(--aster-accent)]" />
            Bulletins de paie — PeopleDoc
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--aster-muted)]">
          <p>
            Conformément au guide des pratiques RH (p.&nbsp;65–66), les bulletins
            de paie sont diffusés via PeopleDoc. ASTER ne génère pas de demande
            de bulletin auprès des RH.
          </p>
          <p>
            Connectez-vous à PeopleDoc avec vos identifiants habituels. Aucune
            URL PeopleDoc n&apos;est publiée ici (non fournie pour la démo).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {canSubmitSelf ? (
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle demande</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeDocumentRequestForm offeredTypes={offeredTypes} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Demandes personnelles</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                compact
                icon={FolderOpen}
                title="Réservé aux collaborateurs"
                description="La publication et le traitement documentaire RH restent disponibles dans l'administration. Les demandes personnelles sont réservées aux collaborateurs."
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Documents disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            {library.length === 0 ? (
              <EmptyState
                compact
                icon={FolderOpen}
                title="Aucun document prêt"
                description="Les fichiers publiés par les RH apparaîtront ici."
              />
            ) : (
              <ul className="space-y-3">
                {library.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--aster-border)]/70 pb-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--aster-ink)]">
                        {doc.customLabel ||
                          documentRequestTypeLabel(doc.documentType)}
                      </p>
                      <p className="text-xs text-[var(--aster-muted)]">
                        Publié le{" "}
                        {doc.publishedAt
                          ? formatDateTimeFr(doc.publishedAt)
                          : "—"}
                      </p>
                    </div>
                    {doc.fileName ? (
                      <DocumentDownloadButton
                        requestId={doc.id}
                        fileName={doc.fileName}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {canSubmitSelf ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Demandes en cours ({pending.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <EmptyState
                  compact
                  icon={FolderOpen}
                  title="Aucune demande en cours"
                  description="Soumettez une demande pour démarrer le traitement RH."
                />
              ) : (
                <RequestTable rows={pending} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState
                  compact
                  icon={FolderOpen}
                  title="Pas encore d'historique"
                  description="Les demandes terminées ou refusées s'afficheront ici."
                />
              ) : (
                <RequestTable rows={history} showMessage />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function RequestTable({
  rows,
  showMessage,
}: {
  rows: Awaited<
    ReturnType<
      ReturnType<
        typeof createDocumentRequestService
      >["listForEmployee"]
    >
  >;
  showMessage?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[var(--aster-border)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--aster-muted)]">
          <tr>
            <th className="px-2 py-2.5 font-medium">Document</th>
            <th className="px-2 py-2.5 font-medium">Statut</th>
            <th className="px-2 py-2.5 font-medium">Soumise le</th>
            <th className="px-2 py-2.5 font-medium">Motif</th>
            {showMessage ? (
              <th className="px-2 py-2.5 font-medium">Message RH</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-[var(--aster-border)]/70 last:border-0"
            >
              <td className="px-2 py-3 font-medium text-[var(--aster-ink)]">
                {r.customLabel || documentRequestTypeLabel(r.documentType)}
              </td>
              <td className="px-2 py-3">
                <Badge variant="outline">
                  {documentRequestStatusLabel(r.status)}
                </Badge>
              </td>
              <td className="px-2 py-3 text-[var(--aster-muted)]">
                {formatDateTimeFr(r.createdAt)}
              </td>
              <td className="px-2 py-3 text-[var(--aster-muted)]">{r.reason}</td>
              {showMessage ? (
                <td className="px-2 py-3 text-[var(--aster-muted)]">
                  {r.hrMessage ?? "—"}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
