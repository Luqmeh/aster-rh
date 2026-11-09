import { createLeaveService } from "@/application/services/leave-service";
import { createTeleworkService } from "@/application/services/telework-service";
import { leaveTypeLabel } from "@/domain/rules/leave";
import { teleworkTypeLabel } from "@/domain/rules/telework";
import {
  canAccessHrAdministration,
  canApproveRequests,
} from "@/domain/rules/permissions";
import { ApprovalButtons } from "@/components/modules/approval-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMonthYearFr } from "@/domain/rules/dates";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr, fullName } from "@/lib/utils";
import Link from "next/link";
import { ClipboardList, FolderOpen, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function AdministrationPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canAccessHrAdministration(session.role)) {
    redirect("/tableau-de-bord");
  }

  const canDecide = canApproveRequests(session.role);
  const leaveService = createLeaveService(container);
  const teleworkService = createTeleworkService(container);
  const [employees, departments, pendingLeaves, pendingTw] = await Promise.all([
    container.hr.listEmployees(),
    container.hr.listDepartments(),
    leaveService.listTeamPending(session),
    teleworkService.listTeamPending(session),
  ]);
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const pendingTotal = pendingLeaves.length + pendingTw.length;

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Administration RH"
        description={
          canDecide
            ? "Pilotage transverse Chef de projet — administration RH et validations."
            : "Vue transverse Ressources humaines — consultation des demandes sans autorité de validation."
        }
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/administration/documents">
              <FolderOpen className="mr-1.5 h-4 w-4" />
              Demandes de documents
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Collaborateurs" value={String(employees.length)} />
        <Stat label="Départements" value={String(departments.length)} />
        <Stat label="Demandes en attente" value={String(pendingTotal)} />
      </div>

      {!canDecide ? (
        <p className="rounded-[10px] border border-[var(--aster-border)] bg-[var(--aster-surface-2)] px-4 py-3 text-sm text-[var(--aster-muted)]">
          Les ressources humaines voient les demandes et historiques, mais ne
          peuvent pas les approuver ni les refuser. Seul le Chef de projet
          dispose de l&apos;autorité de décision.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {canDecide ? "Congés à traiter" : "Congés en cours"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingLeaves.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title="File vide"
                description="Aucune demande de congé en attente."
              />
            ) : (
              pendingLeaves.map((item) => {
                const emp = byId[item.employeeId];
                return (
                  <div
                    key={item.id}
                    className="rounded-[10px] border border-[var(--aster-border)] p-3"
                  >
                    <div className="mb-2 flex justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--aster-ink)]">
                          {emp
                            ? fullName(emp.firstName, emp.lastName)
                            : item.employeeId}
                        </p>
                        <p className="text-xs text-[var(--aster-muted)]">
                          {leaveTypeLabel(item.type)} ·{" "}
                          {formatDateFr(item.startDate)} →{" "}
                          {formatDateFr(item.endDate)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    {canDecide ? (
                      <ApprovalButtons kind="leave" requestId={item.id} />
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {canDecide ? "Télétravail à traiter" : "Télétravail en cours"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTw.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title="File vide"
                description="Aucun plan de télétravail en attente."
              />
            ) : (
              pendingTw.map((item) => {
                const emp = byId[item.employeeId];
                return (
                  <div
                    key={item.id}
                    className="rounded-[10px] border border-[var(--aster-border)] p-3"
                  >
                    <div className="mb-2 flex justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--aster-ink)]">
                          {emp
                            ? fullName(emp.firstName, emp.lastName)
                            : item.employeeId}
                        </p>
                        <p className="text-xs text-[var(--aster-muted)]">
                          {teleworkTypeLabel(item.type)}
                          {item.month
                            ? ` · ${formatMonthYearFr(item.month)}`
                            : ""}{" "}
                          · {item.days.map(formatDateFr).join(", ")}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    {canDecide ? (
                      <ApprovalButtons
                        kind="telework"
                        requestId={item.id}
                        requireRejectionReason
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--aster-muted)]" />
            Organisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => (
              <li
                key={d.id}
                className="rounded-[10px] border border-[var(--aster-border)] px-3 py-2.5 text-sm"
              >
                <p className="font-medium text-[var(--aster-ink)]">{d.name}</p>
                <p className="text-xs text-[var(--aster-muted)]">{d.code}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-[var(--aster-muted)]">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--aster-ink)]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
