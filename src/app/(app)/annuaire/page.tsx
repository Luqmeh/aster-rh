import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";
import { createEmployeeService } from "@/application/services/employee-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { UserAvatar } from "@/components/ui/user-avatar";
import { canBrowseDirectory } from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";
import { fullName } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm text-[var(--aster-ink)]";

export default async function AnnuairePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    departmentId?: string;
    managerId?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canBrowseDirectory(session.role)) {
    redirect("/profil");
  }

  const service = createEmployeeService(container);
  const status =
    params.status === "inactif" || params.status === "tous"
      ? params.status
      : params.status === "actif"
        ? "actif"
        : "actif";

  const [employees, departments, allForManagers] = await Promise.all([
    service.listDirectory(session, {
      q: params.q,
      departmentId: params.departmentId || undefined,
      managerId: params.managerId || undefined,
      status,
    }),
    container.hr.listDepartments(),
    container.hr.listEmployees({ includeInactive: true }),
  ]);

  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]));
  const managers = allForManagers.filter((e) =>
    allForManagers.some((other) => other.managerId === e.id),
  );

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Annuaire collaborateurs"
        description="Répertoire persistant — recherche, filtres et fiches collaborateurs."
      />

      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--aster-muted)]"
                aria-hidden
              />
              <Input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Nom, e-mail, identifiant, poste…"
                className="pl-9"
                aria-label="Rechercher un collaborateur"
              />
            </div>
            <select
              name="departmentId"
              className={selectClassName}
              defaultValue={params.departmentId ?? ""}
              aria-label="Département"
            >
              <option value="">Tous les départements</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              name="managerId"
              className={selectClassName}
              defaultValue={params.managerId ?? ""}
              aria-label="Équipe (manager)"
            >
              <option value="">Toutes les équipes</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  Équipe {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
            <select
              name="status"
              className={selectClassName}
              defaultValue={status}
              aria-label="Statut d'emploi"
            >
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
              <option value="tous">Tous les statuts</option>
            </select>
            <button
              type="submit"
              className="h-9 rounded-[8px] bg-[var(--aster-navy)] px-4 text-sm font-medium text-white"
            >
              Filtrer
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {employees.length} collaborateur{employees.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun résultat"
              description="Modifiez votre recherche ou vos filtres."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-[var(--aster-border)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--aster-muted)]">
                  <tr>
                    <th className="px-2 py-2.5 font-medium">Collaborateur</th>
                    <th className="px-2 py-2.5 font-medium">Identifiant</th>
                    <th className="px-2 py-2.5 font-medium">Poste</th>
                    <th className="px-2 py-2.5 font-medium">Département</th>
                    <th className="px-2 py-2.5 font-medium">Site</th>
                    <th className="px-2 py-2.5 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-[var(--aster-border)]/70 last:border-0"
                    >
                      <td className="px-2 py-3">
                        <Link
                          href={`/annuaire/${e.id}`}
                          className="flex items-center gap-2.5 rounded-md hover:bg-[var(--aster-surface-2)]"
                        >
                          <UserAvatar initials={e.avatarInitials} size="sm" />
                          <div>
                            <p className="font-medium text-[var(--aster-ink)]">
                              {fullName(e.firstName, e.lastName)}
                            </p>
                            <p className="text-xs text-[var(--aster-muted)]">
                              {e.email}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-2 py-3 font-mono text-xs text-[var(--aster-muted)]">
                        {e.id}
                      </td>
                      <td className="px-2 py-3 text-[var(--aster-ink)]">
                        {e.jobTitle}
                      </td>
                      <td className="px-2 py-3 text-[var(--aster-ink)]">
                        {deptById[e.departmentId]?.name ?? "—"}
                      </td>
                      <td className="px-2 py-3 text-[var(--aster-ink)]">
                        {e.site}
                      </td>
                      <td className="px-2 py-3">
                        {e.isActive ? (
                          <Badge variant="success">Actif</Badge>
                        ) : (
                          <Badge variant="danger">Inactif</Badge>
                        )}
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
