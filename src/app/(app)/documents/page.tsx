import { FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getContainer } from "@/infrastructure/container";
import { formatDateTimeFr } from "@/lib/utils";

export default async function DocumentsPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  const docs = await container.hr.listDocuments(session.employee.id);
  const withUrls = await Promise.all(
    docs.map(async (doc) => ({
      doc,
      url: await container.storage.getDownloadUrl(doc.storageKey),
    })),
  );

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Mes documents"
        description="Bibliothèque mock — aucun fichier réel n’est hébergé. L’aperçu ouvre une URL factice."
      />
      <Card>
        <CardHeader>
          <CardTitle>Bibliothèque</CardTitle>
        </CardHeader>
        <CardContent>
          {withUrls.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Aucun document"
              description="Les documents de démonstration apparaîtront ici."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-[var(--aster-border)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--aster-muted)]">
                  <tr>
                    <th className="px-2 py-2.5 font-medium">Document</th>
                    <th className="px-2 py-2.5 font-medium">Catégorie</th>
                    <th className="px-2 py-2.5 font-medium">Périmètre</th>
                    <th className="px-2 py-2.5 font-medium">Date</th>
                    <th className="px-2 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {withUrls.map(({ doc, url }) => (
                    <tr
                      key={doc.id}
                      className="border-b border-[var(--aster-border)]/70 last:border-0"
                    >
                      <td className="px-2 py-3 font-medium text-[var(--aster-ink)]">
                        {doc.title}
                      </td>
                      <td className="px-2 py-3 text-[var(--aster-muted)]">
                        {doc.category}
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant={doc.isCompanyWide ? "secondary" : "outline"}>
                          {doc.isCompanyWide ? "Entreprise" : "Personnel"}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 text-[var(--aster-muted)]">
                        {formatDateTimeFr(doc.uploadedAt)}
                      </td>
                      <td className="px-2 py-3">
                        <a
                          href={url}
                          className="text-sm font-medium text-[var(--aster-accent)] hover:underline"
                        >
                          Aperçu démo
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
