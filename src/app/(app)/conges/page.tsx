import { CalendarDays } from "lucide-react";
import { createLeaveService } from "@/application/services/leave-service";
import { leaveTypeLabel } from "@/domain/rules/leave";
import {
  canApproveRequests,
  canViewAllRequests,
} from "@/domain/rules/permissions";
import { ApprovalButtons } from "@/components/modules/approval-buttons";
import { LeaveForm } from "@/components/modules/leave-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr, fullName } from "@/lib/utils";

export default async function CongesPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  const service = createLeaveService(container);
  const canViewQueue = canViewAllRequests(session.role);
  const canDecide = canApproveRequests(session.role);
  const [mine, pending, balance, employees] = await Promise.all([
    service.listForCurrentUser(session),
    service.listTeamPending(session),
    service.getBalance(session),
    container.hr.listEmployees(),
  ]);
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Congés (CP / RTT)"
        description="Soumission et validation des congés payés, RTT et absences courtes — distinct des arrêts de travail."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[var(--aster-muted)]">CP restants</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {balance?.congesPayesRestants ?? "—"}
              <span className="ml-1 text-sm font-medium text-[var(--aster-muted)]">
                j
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[var(--aster-muted)]">RTT restants</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {balance?.rttRestants ?? "—"}
              <span className="ml-1 text-sm font-medium text-[var(--aster-muted)]">
                j
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[var(--aster-muted)]">Catégorie</p>
            <p className="mt-1 text-2xl font-semibold capitalize tracking-tight">
              {session.employee.category.replace("_", "-")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle demande</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveForm />
          </CardContent>
        </Card>

        {canViewQueue && (
          <Card>
            <CardHeader>
              <CardTitle>
                {canDecide ? "À valider" : "Demandes en cours (lecture)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!canDecide ? (
                <p className="text-xs text-[var(--aster-muted)]">
                  Les ressources humaines consultent les demandes sans pouvoir
                  les approuver ni les refuser.
                </p>
              ) : null}
              {pending.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Aucune demande en attente"
                  description="Les demandes à traiter apparaîtront ici."
                />
              ) : (
                pending.map((item) => {
                  const emp = byId[item.employeeId];
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[var(--aster-border)] p-3"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {emp
                              ? fullName(emp.firstName, emp.lastName)
                              : item.employeeId}
                          </p>
                          <p className="text-xs text-[var(--aster-muted)]">
                            {leaveTypeLabel(item.type)} ·{" "}
                            {formatDateFr(item.startDate)} →{" "}
                            {formatDateFr(item.endDate)} · {item.daysCount} j
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
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mes demandes</CardTitle>
        </CardHeader>
        <CardContent>
          {mine.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Aucune demande"
              description="Soumettez une première demande de congés."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-[var(--aster-border)] text-xs uppercase tracking-wide text-[var(--aster-muted)]">
                  <tr>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Période</th>
                    <th className="px-2 py-2 font-medium">Jours</th>
                    <th className="px-2 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--aster-border)]/70"
                    >
                      <td className="px-2 py-3">{leaveTypeLabel(item.type)}</td>
                      <td className="px-2 py-3">
                        {formatDateFr(item.startDate)} →{" "}
                        {formatDateFr(item.endDate)}
                      </td>
                      <td className="px-2 py-3">{item.daysCount}</td>
                      <td className="px-2 py-3">
                        <StatusBadge status={item.status} />
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
