import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UserAvatar } from "@/components/ui/user-avatar";
import { roleLabel } from "@/domain/rules/approvals";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr, formatDateTimeFr } from "@/lib/utils";

export default async function ProfilPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  const { employee, role } = session;
  const departments = await container.hr.listDepartments();
  const dept = departments.find((d) => d.id === employee.departmentId);
  const manager = employee.managerId
    ? await container.hr.getEmployee(employee.managerId)
    : null;
  const docs = await container.hr.listDocuments(employee.id);

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Mon profil"
        description="Fiche collaborateur de démonstration — données seedées, non éditables en production."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar initials={employee.avatarInitials} size="lg" />
            <div>
              <p className="text-lg font-semibold tracking-tight text-[var(--aster-ink)]">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-sm text-[var(--aster-muted)]">
                {employee.jobTitle}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="accent">{roleLabel(role)}</Badge>
                <Badge variant="secondary">
                  {employee.category === "cadre" ? "Cadre" : "Non-cadre"}
                </Badge>
                {employee.isActive ? (
                  <Badge variant="success">Actif</Badge>
                ) : (
                  <Badge variant="danger">Inactif</Badge>
                )}
              </div>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/documents">
              <FolderOpen className="h-3.5 w-3.5" />
              Documents
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" value={employee.email} />
            <Field
              label="Téléphone interne"
              value={employee.phoneInternal ?? "—"}
            />
            <Field label="Site" value={employee.site} />
            <Field label="Département" value={dept?.name ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emploi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Manager"
              value={
                manager
                  ? `${manager.firstName} ${manager.lastName}`
                  : "— (direction)"
              }
            />
            <Field
              label="Contrat"
              value={employee.contractType.toUpperCase()}
            />
            <Field
              label="Date d'entrée"
              value={formatDateFr(employee.hireDate)}
            />
            <Field
              label="Éligibilité télétravail"
              value={
                employee.teleworkEligible
                  ? "Éligible (guide RH p.106)"
                  : "Non éligible (démo)"
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Documents liés</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/documents">Tout voir</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.length === 0 ? (
            <p className="text-sm text-[var(--aster-muted)]">
              Aucun document associé.
            </p>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-[var(--aster-border)] px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-[var(--aster-ink)]">
                    {doc.title}
                  </p>
                  <p className="text-xs text-[var(--aster-muted)]">
                    {doc.category} · {formatDateTimeFr(doc.uploadedAt)}
                  </p>
                </div>
                <Badge variant="outline">Démo</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--aster-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--aster-ink)]">{value}</p>
    </div>
  );
}
