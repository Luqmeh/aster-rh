import { CalendarDays } from "lucide-react";
import { createLeaveApprovalContextService } from "@/application/services/leave-approval-context-service";
import { createLeaveService } from "@/application/services/leave-service";
import { leaveTypeLabel } from "@/domain/rules/leave";
import {
  canApproveRequests,
  canSubmitLeaveRequest,
  canViewAllRequests,
} from "@/domain/rules/permissions";
import { LeaveForm } from "@/components/modules/leave-form";
import { PendingLeaveRequestCard } from "@/components/modules/pending-leave-request-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr } from "@/lib/utils";

export default async function CongesPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  const service = createLeaveService(container);
  const contextService = createLeaveApprovalContextService(container);
  const canViewQueue = canViewAllRequests(session.role);
  const canDecide = canApproveRequests(session.role);
  const canSubmitSelf = canSubmitLeaveRequest(session.role);
  const [mine, pending, balance] = await Promise.all([
    service.listForCurrentUser(session),
    service.listTeamPending(session),
    service.getBalance(session),
  ]);
  const pendingContexts = canViewQueue
    ? await contextService.getLeaveRequestContexts(session, pending)
    : {};

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Congés et absences"
        description="Demandes de congés payés, RTT et récupération — demi-journées possibles. Les arrêts maladie se déclarent dans Arrêts & absences spéciales."
      />

      {canSubmitSelf ? (
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
              <p className="text-xs text-[var(--aster-muted)]">
                Récupération restants
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {balance?.recoveryDaysRestants ?? "—"}
                <span className="ml-1 text-sm font-medium text-[var(--aster-muted)]">
                  j
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {canSubmitSelf ? (
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle demande</CardTitle>
            </CardHeader>
            <CardContent>
              <LeaveForm />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Libre-service congés</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={CalendarDays}
                title="Réservé aux collaborateurs"
                description="Les comptes Senior Manager et Responsable RH gèrent les demandes des collaborateurs, sans dépôt de demande personnelle."
              />
            </CardContent>
          </Card>
        )}

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
                pending.map((item) => (
                  <PendingLeaveRequestCard
                    key={item.id}
                    request={item}
                    context={pendingContexts[item.id]}
                    canDecide={canDecide}
                  />
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {canSubmitSelf ? (
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
      ) : null}
    </div>
  );
}
