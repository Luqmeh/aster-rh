import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getContainer } from "@/infrastructure/container";
import { fullName } from "@/lib/utils";

export default async function AnnuairePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const container = getContainer();
  const [employees, departments] = await Promise.all([
    container.hr.listEmployees(),
    container.hr.listDepartments(),
  ]);
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]));
  const query = (q ?? "").trim().toLowerCase();
  const filtered = employees.filter((e) => {
    if (!query) return true;
    const hay =
      `${e.firstName} ${e.lastName} ${e.jobTitle} ${e.email} ${deptById[e.departmentId]?.name ?? ""}`.toLowerCase();
    return hay.includes(query);
  });

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Annuaire collaborateurs"
        description="Répertoire de démonstration — recherche locale sur le magasin mémoire."
      />

      <Card>
        <CardContent className="pt-5">
          <form className="relative max-w-lg">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--aster-muted)]"
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nom, poste, département…"
              className="pl-9"
              aria-label="Rechercher un collaborateur"
            />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {filtered.length} collaborateur{filtered.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun résultat"
              description="Modifiez votre recherche."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-[var(--aster-border)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--aster-muted)]">
                  <tr>
                    <th className="px-2 py-2.5 font-medium">Collaborateur</th>
                    <th className="px-2 py-2.5 font-medium">Poste</th>
                    <th className="px-2 py-2.5 font-medium">Département</th>
                    <th className="px-2 py-2.5 font-medium">Site</th>
                    <th className="px-2 py-2.5 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-[var(--aster-border)]/70 last:border-0"
                    >
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar initials={e.avatarInitials} size="sm" />
                          <div>
                            <p className="font-medium text-[var(--aster-ink)]">
                              {fullName(e.firstName, e.lastName)}
                            </p>
                            <p className="text-xs text-[var(--aster-muted)]">
                              {e.email}
                            </p>
                          </div>
                        </div>
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
