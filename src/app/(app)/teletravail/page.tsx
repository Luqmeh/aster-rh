import Link from "next/link";
import { Laptop, Pencil } from "lucide-react";
import { createCalendarService } from "@/application/services/calendar-service";
import { createTeleworkService } from "@/application/services/telework-service";
import { HrCalendar } from "@/components/calendar/hr-calendar";
import { ApprovalButtons } from "@/components/modules/approval-buttons";
import {
  MonthlyTeleworkPlanner,
  WithdrawPlanButton,
} from "@/components/modules/monthly-telework-planner";
import {
  assertPlanEditable,
  buildPlannerPrefill,
  planStatusCaption,
} from "@/components/modules/telework-plan-edit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  currentMonthKey,
  formatMonthYearFr,
  isoWeekKey,
} from "@/domain/rules/dates";
import {
  canApproveRequests,
  canSubmitTeleworkRequest,
  canViewAllRequests,
  hasGlobalPeopleScope,
} from "@/domain/rules/permissions";
import { assertTeleworkEligibility } from "@/domain/rules/telework-monthly";
import { getContainer } from "@/infrastructure/container";
import { cn, formatDateFr, fullName } from "@/lib/utils";

export default async function TeletravailPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  const service = createTeleworkService(container);
  const calendar = createCalendarService(container);
  const month = currentMonthKey();
  const canViewQueue = canViewAllRequests(session.role);
  const canDecide = canApproveRequests(session.role);
  const canSubmitSelf = canSubmitTeleworkRequest(session.role);

  const [mine, pending, employees, calendarData] = await Promise.all([
    service.listForCurrentUser(session),
    service.listTeamPending(session),
    container.hr.listEmployees(),
    hasGlobalPeopleScope(session.role)
      ? calendar.getTeamMonth(session, month)
      : calendar.getEmployeeMonth(session, month),
  ]);
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const eligibility = assertTeleworkEligibility(session.employee);
  const activePlans = mine.filter((p) => p.status !== "annulee");

  const editCandidate = edit
    ? (mine.find((p) => p.id === edit) ?? null)
    : null;
  const editCheck = edit
    ? assertPlanEditable(editCandidate, session.employee.id)
    : null;
  const prefill =
    editCheck?.ok === true ? buildPlannerPrefill(editCheck.plan) : null;
  const editError =
    edit && editCheck && !editCheck.ok ? editCheck.message : null;

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Télétravail"
        description="Planification mensuelle — règles produit : jusqu’à 2 jours par semaine et 12 jours par mois (paramétrables selon le cadre retenu). Validations Chef de projet."
      />

      {editError ? (
        <div
          role="alert"
          className="rounded-xl border border-[var(--aster-danger)]/30 bg-[var(--aster-danger-bg)] px-4 py-3 text-sm text-[var(--aster-danger)]"
        >
          {editError}{" "}
          <Link href="/teletravail" className="underline">
            Revenir à la planification
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {canSubmitSelf ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {prefill ? "Modifier mon plan en attente" : "Planifier le mois"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyTeleworkPlanner
                key={prefill?.editingPlanId ?? "new-plan"}
                eligible={eligibility.ok}
                eligibilityMessage={
                  eligibility.ok ? undefined : eligibility.message
                }
                editingPlanId={prefill?.editingPlanId}
                initialMonth={prefill?.initialMonth}
                initialDays={prefill?.initialDays}
                initialReason={prefill?.initialReason}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Libre-service télétravail</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Laptop}
                title="Réservé aux collaborateurs"
                description="Les comptes management consultent et décident les plans des collaborateurs, sans planifier un télétravail personnel."
              />
            </CardContent>
          </Card>
        )}

        {canViewQueue && (
          <Card>
            <CardHeader>
              <CardTitle>
                {canDecide ? "Plans à valider" : "Plans en cours (lecture)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!canDecide ? (
                <p className="text-xs text-[var(--aster-muted)]">
                  Les ressources humaines consultent les plans sans pouvoir les
                  approuver ni les refuser.
                </p>
              ) : null}
              {pending.length === 0 ? (
                <EmptyState
                  icon={Laptop}
                  title="Aucun plan en attente"
                  description="Les plans mensuels à traiter apparaîtront ici."
                />
              ) : (
                pending.map((item) => {
                  const emp = byId[item.employeeId];
                  const weeks = groupSelectedByWeek(item.days);
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
                            {item.month
                              ? formatMonthYearFr(item.month)
                              : "Plan"}{" "}
                            · {item.days.length} jour(s)
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="mb-3 space-y-1 text-xs text-[var(--aster-muted)]">
                        {weeks.map((w) => (
                          <p key={w.weekKey}>
                            {w.weekKey} : {w.days.map(formatDateFr).join(", ")}
                          </p>
                        ))}
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
        )}
      </div>

      {canSubmitSelf ? (
      <Card>
        <CardHeader>
          <CardTitle>Mes plans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activePlans.length === 0 ? (
            <EmptyState
              icon={Laptop}
              title="Aucun plan"
              description="Soumettez un plan mensuel pour la démonstration."
            />
          ) : (
            activePlans.map((item) => {
              const isPending = item.status === "en_attente_manager";
              const isEditingThis = prefill?.editingPlanId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-start sm:justify-between",
                    item.status === "approuvee" &&
                      "border-[var(--aster-success)]/35 bg-[var(--aster-success-bg)]/40",
                    item.status === "refusee" &&
                      "border-[var(--aster-danger)]/30 bg-[var(--aster-danger-bg)]/50",
                    isPending &&
                      "border-[var(--aster-warning)]/40 bg-[var(--aster-warning-bg)]/40",
                    isEditingThis && "ring-2 ring-[var(--aster-accent)]/40",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {item.month
                        ? formatMonthYearFr(item.month)
                        : "Plan télétravail"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--aster-muted)]">
                      {planStatusCaption(item.status)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--aster-muted)]">
                      {item.days.map(formatDateFr).join(" · ")}
                    </p>
                    {item.managerComment ? (
                      <p className="mt-1 text-xs text-[var(--aster-muted)]">
                        Décision : {item.managerComment}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={item.status} />
                    {isPending ? (
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant={isEditingThis ? "default" : "accent"}>
                          <Link href={`/teletravail?edit=${item.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                            {isEditingThis ? "En cours…" : "Modifier"}
                          </Link>
                        </Button>
                        <WithdrawPlanButton requestId={item.id} />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      ) : null}

      <HrCalendar
        initialMonth={month}
        events={calendarData.events}
        title={
          session.role === "collaborateur"
            ? "Mon calendrier télétravail & absences"
            : "Calendrier d'équipe"
        }
        subtitle="Congés et télétravail issus des demandes existantes — les refus restent distincts des événements confirmés."
      />
    </div>
  );
}

function groupSelectedByWeek(days: string[]) {
  const map = new Map<string, string[]>();
  for (const day of days) {
    const key = isoWeekKey(day);
    map.set(key, [...(map.get(key) ?? []), day]);
  }
  return [...map.entries()].map(([weekKey, weekDays]) => ({
    weekKey,
    days: weekDays,
  }));
}
