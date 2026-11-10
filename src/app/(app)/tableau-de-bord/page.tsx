import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  Plane,
  UserRound,
  Users,
} from "lucide-react";
import { createCalendarService } from "@/application/services/calendar-service";
import { createDashboardService } from "@/application/services/dashboard-service";
import { createLeaveService } from "@/application/services/leave-service";
import { createTeleworkService } from "@/application/services/telework-service";
import { HrCalendar } from "@/components/calendar/hr-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { QuickAction } from "@/components/ui/quick-action";
import { StatusBadge } from "@/components/ui/status-badge";
import { currentMonthKey, formatMonthYearFr } from "@/domain/rules/dates";
import { leaveTypeLabel } from "@/domain/rules/leave";
import {
  canApproveRequests,
  canViewAllRequests,
  hasGlobalPeopleScope,
} from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr, formatDateTimeFr } from "@/lib/utils";

function greetingFor(hour: number) {
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

export default async function TableauDeBordPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");

  const dashboard = createDashboardService(container);
  const leaveService = createLeaveService(container);
  const teleworkService = createTeleworkService(container);
  const calendarService = createCalendarService(container);
  const month = currentMonthKey();

  const [overview, myLeaves, myTelework, calendarData] = await Promise.all([
    dashboard.getOverview(session),
    leaveService.listForCurrentUser(session),
    teleworkService.listForCurrentUser(session),
    hasGlobalPeopleScope(session.role)
      ? calendarService.getTeamMonth(session, month)
      : calendarService.getEmployeeMonth(session, month),
  ]);

  const { employee, role, balance, pendingLeaves, pendingTelework, notifications } =
    overview;
  const greeting = greetingFor(new Date().getHours());
  const canDecide = canApproveRequests(role);
  const canViewQueue = canViewAllRequests(role);
  const isHrScope = hasGlobalPeopleScope(role);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  const upcomingAbsences = myLeaves
    .filter(
      (r) =>
        r.status === "approuvee" && r.endDate >= todayIso,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 4);

  const upcomingTelework = myTelework
    .filter((p) => p.status === "approuvee")
    .flatMap((p) =>
      p.days
        .filter((d) => d >= todayIso)
        .map((d) => ({ date: d, planId: p.id })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const myPending = [
    ...myLeaves
      .filter(
        (r) =>
          r.status === "en_attente_manager" || r.status === "en_attente_rh",
      )
      .map((r) => ({
        id: r.id,
        label: leaveTypeLabel(r.type),
        detail: `${formatDateFr(r.startDate)} → ${formatDateFr(r.endDate)}`,
        status: r.status,
        href: "/conges" as const,
      })),
    ...myTelework
      .filter(
        (p) =>
          p.status === "en_attente_manager" || p.status === "en_attente_rh",
      )
      .map((p) => ({
        id: p.id,
        label: "Télétravail",
        detail: `${p.month ? formatMonthYearFr(p.month) : "Plan"} · ${p.days.length} j.`,
        status: p.status,
        href: "/teletravail" as const,
      })),
  ];

  const pendingCount = pendingLeaves.length + pendingTelework.length;

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title={`${greeting}, ${employee.firstName}`}
        description="Votre espace ASTER — congés, télétravail et actualités RH."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/conges">Demander un congé</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/teletravail">Planifier mon télétravail</Link>
            </Button>
          </div>
        }
      />

      {canViewQueue && pendingCount > 0 ? (
        <Card className="border-[var(--aster-warning)]/30 bg-[var(--aster-warning-bg)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-[var(--aster-warning)]" />
              {canDecide ? "À traiter" : "Demandes en cours"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-[var(--aster-ink)]">
            {pendingLeaves.length > 0 ? (
              <span>
                <strong>{pendingLeaves.length}</strong> demande
                {pendingLeaves.length > 1 ? "s" : ""} de congé
              </span>
            ) : null}
            {pendingTelework.length > 0 ? (
              <span>
                <strong>{pendingTelework.length}</strong> plan
                {pendingTelework.length > 1 ? "s" : ""} de télétravail
              </span>
            ) : null}
            <Button asChild size="sm" className="ml-auto">
              <Link href="/administration">
                {canDecide ? "Ouvrir les validations" : "Voir l'administration"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <p className="text-xs text-[var(--aster-muted)]">Demandes ouvertes</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {overview.myLeavesOpen + overview.myTeleworkOpen}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[var(--aster-muted)]">Notifications non lues</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {overview.unreadNotifications}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction
          href="/conges"
          label="Demander un congé"
          description="Soumettre une absence"
          icon={Plane}
        />
        <QuickAction
          href="/teletravail"
          label="Planifier mon télétravail"
          description="Sélection mensuelle"
          icon={CalendarDays}
        />
        <QuickAction
          href="/documents"
          label="Mes documents"
          description="Demandes et pièces RH publiées"
          icon={FolderOpen}
        />
        <QuickAction
          href="/profil"
          label="Mettre à jour mon profil"
          description="Coordonnées et infos"
          icon={UserRound}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-[var(--aster-ink)]">
              Calendrier RH
            </h2>
            <Button asChild size="sm" variant="ghost">
              <Link href="/calendrier">Vue complète</Link>
            </Button>
          </div>
          <HrCalendar
            initialMonth={month}
            events={calendarData.events}
            title={isHrScope ? "Organisation" : "Mon mois"}
            subtitle="Événements dérivés des congés et plans de télétravail — les refus restent distincts."
            compact
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prochaines absences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingAbsences.length === 0 ? (
                <EmptyState
                  compact
                  title="Aucune absence à venir"
                  description="Les congés approuvés apparaîtront ici."
                />
              ) : (
                upcomingAbsences.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-[var(--aster-border)] px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--aster-ink)]">
                        {leaveTypeLabel(r.type)}
                      </p>
                      <p className="text-xs text-[var(--aster-muted)]">
                        {formatDateFr(r.startDate)} → {formatDateFr(r.endDate)}{" "}
                        · {r.daysCount} j.
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Télétravail à venir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingTelework.length === 0 ? (
                <EmptyState
                  compact
                  title="Aucun jour planifié"
                  description="Les jours de télétravail approuvés s’affichent ici."
                />
              ) : (
                upcomingTelework.map((item) => (
                  <div
                    key={`${item.planId}-${item.date}`}
                    className="flex items-center gap-2 text-sm text-[var(--aster-ink)]"
                  >
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-[var(--aster-accent)]"
                      aria-hidden
                    />
                    {formatDateFr(item.date)}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Mes demandes en cours</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/conges">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {myPending.length === 0 ? (
              <EmptyState
                compact
                title="Rien en attente"
                description="Vos prochaines demandes apparaîtront ici."
              />
            ) : (
              myPending.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[var(--aster-border)] px-3 py-2.5 transition-colors hover:bg-[var(--aster-surface-2)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--aster-ink)]">
                      {item.label}
                    </p>
                    <p className="text-xs text-[var(--aster-muted)]">
                      {item.detail}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Notifications</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/notifications">Tout voir</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 ? (
              <EmptyState
                compact
                icon={Bell}
                title="Aucune notification"
                description="Les alertes RH s’afficheront ici."
              />
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-[var(--aster-border)] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--aster-ink)]">
                      {n.title}
                    </p>
                    {!n.read ? (
                      <span
                        className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--aster-accent)]"
                        aria-label="Non lue"
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--aster-muted)]">
                    {n.body}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--aster-muted)]">
                    {formatDateTimeFr(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {isHrScope ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {canDecide
                ? "Pilotage Chef de projet"
                : "Raccourcis administration RH"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <QuickAction
              href="/annuaire"
              label="Annuaire"
              description="Collaborateurs"
              icon={Users}
            />
            <QuickAction
              href="/administration"
              label={canDecide ? "Validations" : "Suivi des demandes"}
              description="Congés et télétravail"
              icon={ClipboardList}
            />
            <QuickAction
              href="/calendrier"
              label="Calendrier org."
              description="Vue mensuelle"
              icon={CalendarDays}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
