import { createLeaveApprovalContextService } from "@/application/services/leave-approval-context-service";
import { createLeaveService } from "@/application/services/leave-service";
import { createTeleworkService } from "@/application/services/telework-service";
import { createWorkOnHolidayService } from "@/application/services/work-on-holiday-service";
import { teleworkTypeLabel } from "@/domain/rules/telework";
import { workOnHolidayStatusLabel } from "@/domain/rules/work-on-holiday";
import {
  canAccessHrAdministration,
  canApproveRequests,
} from "@/domain/rules/permissions";
import { ApprovalButtons } from "@/components/modules/approval-buttons";
import { HolidayOverrideForm } from "@/components/modules/holiday-override-form";
import { PendingLeaveRequestCard } from "@/components/modules/pending-leave-request-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMonthYearFr } from "@/domain/rules/dates";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr, fullName } from "@/lib/utils";
import Link from "next/link";
import { BarChart3, ClipboardList, FolderOpen, Users } from "lucide-react";
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
  const contextService = createLeaveApprovalContextService(container);
  const teleworkService = createTeleworkService(container);
  const wohService = createWorkOnHolidayService(container);
  const [employees, departments, pendingLeaves, pendingTw, wohRequests] =
    await Promise.all([
      container.hr.listEmployees(),
      container.hr.listDepartments(),
      leaveService.listTeamPending(session),
      teleworkService.listTeamPending(session),
      wohService.listVisible(session),
    ]);
  const pendingLeaveContexts = await contextService.getLeaveRequestContexts(
    session,
    pendingLeaves,
  );
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const pendingTotal = pendingLeaves.length + pendingTw.length;
  const wohUpcoming = wohRequests.filter((r) => r.status === "en_attente");
  const wohApproved = wohRequests.filter((r) => r.status === "approuvee");
  const wohAwaitingConfirm = wohRequests.filter(
    (r) => r.status === "travail_effectue_a_confirmer",
  );
  const wohCredited = wohRequests.filter(
    (r) => r.status === "confirmee_credit_appliquee",
  );

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
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/administration/rapports">
                <BarChart3 className="mr-1.5 h-4 w-4" />
                Reporting RH
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/administration/documents">
                <FolderOpen className="mr-1.5 h-4 w-4" />
                Demandes de documents
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/administration/droits-conges">
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Droits à congés
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Collaborateurs" value={String(employees.length)} />
        <Stat label="Départements" value={String(departments.length)} />
        <Stat label="Demandes en attente" value={String(pendingTotal)} />
      </div>

      {!canDecide ? (
        <p className="rounded-[10px] border border-[var(--aster-border)] bg-[var(--aster-surface-2)] px-4 py-3 text-sm text-[var(--aster-muted)]">
          Les ressources humaines consultent et suivent les demandes sans les
          approuver ni les refuser. Historiques et indicateurs :{" "}
          <Link
            href="/administration/rapports"
            className="font-medium text-[var(--aster-ink)] underline"
          >
            Reporting RH
          </Link>
          . Seul le Chef de projet dispose de l&apos;autorité de décision.
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
              pendingLeaves.map((item) => (
                <PendingLeaveRequestCard
                  key={item.id}
                  request={item}
                  context={pendingLeaveContexts[item.id]}
                  canDecide={canDecide}
                />
              ))
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
          <CardTitle>Calendrier férié — corrections RH</CardTitle>
        </CardHeader>
        <CardContent>
          <HolidayOverrideForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Travail les jours fériés (lecture RH)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-[var(--aster-muted)]">
            Vue de rapprochement — les RH consultent sans pouvoir approuver ni
            confirmer (réservé au Chef de projet). Règle produit ASTER : 1 h
            confirmée = 1 h de récupération (hors guide PKF).
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label="En attente" value={String(wohUpcoming.length)} />
            <Stat label="Approuvées" value={String(wohApproved.length)} />
            <Stat
              label="À confirmer"
              value={String(wohAwaitingConfirm.length)}
            />
            <Stat label="Créditées" value={String(wohCredited.length)} />
          </div>
          {wohRequests.length === 0 ? (
            <EmptyState
              compact
              icon={ClipboardList}
              title="Aucune demande"
              description="Les demandes de travail un jour férié apparaîtront ici."
            />
          ) : (
            <ul className="space-y-2">
              {wohRequests.slice(0, 8).map((r) => {
                const emp = byId[r.employeeId];
                return (
                  <li
                    key={r.id}
                    className="rounded-[10px] border border-[var(--aster-border)] px-3 py-2"
                  >
                    <p className="font-medium text-[var(--aster-ink)]">
                      {emp
                        ? fullName(emp.firstName, emp.lastName)
                        : r.employeeId}{" "}
                      · {r.holidayDate} · {r.holidayName}
                    </p>
                    <p className="text-xs text-[var(--aster-muted)]">
                      {workOnHolidayStatusLabel(r.status)}
                      {r.confirmedHours != null
                        ? ` · ${r.confirmedHours} h confirmées`
                        : r.plannedHours
                          ? ` · ${r.plannedHours} h planifiées`
                          : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

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
