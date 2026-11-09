import type { ChartBucket } from "@/application/services/reporting-service";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function BarChart({
  title,
  data,
  emptyLabel,
}: {
  title: string;
  data: ChartBucket[];
  emptyLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[var(--aster-ink)]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || max === 0 ? (
          <EmptyState title="Aucune donnée" description={emptyLabel} />
        ) : (
          <ul className="space-y-2.5">
            {data.map((item) => {
              const pct = max > 0 ? Math.round((item.value / max) * 100) : 0;
              return (
                <li key={item.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="truncate text-[var(--aster-muted)]">
                      {item.label}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-[var(--aster-ink)]">
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-[var(--aster-border)]/60">
                    <div
                      className="h-full rounded bg-[var(--aster-navy)] transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportingCharts({
  charts,
}: {
  charts: {
    workforceByDepartment: ChartBucket[];
    absenceDaysByMonth: ChartBucket[];
    leaveStatusDistribution: ChartBucket[];
    teleworkDaysByMonth: ChartBucket[];
    recruitmentByStatus: ChartBucket[];
    documentRequestsByStatus: ChartBucket[];
    workAbsencesByCategory: ChartBucket[];
  };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BarChart
        title="Effectif actif par département"
        data={charts.workforceByDepartment}
        emptyLabel="Aucun collaborateur actif pour ces filtres."
      />
      <BarChart
        title="Jours d'absence approuvés par mois"
        data={charts.absenceDaysByMonth}
        emptyLabel="Aucune absence approuvée sur la période."
      />
      <BarChart
        title="Demandes de congés par statut"
        data={charts.leaveStatusDistribution}
        emptyLabel="Aucune demande de congé sur la période."
      />
      <BarChart
        title="Jours de télétravail approuvés par mois"
        data={charts.teleworkDaysByMonth}
        emptyLabel="Aucun jour de télétravail approuvé sur la période."
      />
      <BarChart
        title="Pipeline recrutement par statut"
        data={charts.recruitmentByStatus}
        emptyLabel="Aucun dossier de recrutement."
      />
      <BarChart
        title="Demandes de documents par statut"
        data={charts.documentRequestsByStatus}
        emptyLabel="Aucune demande documentaire sur la période."
      />
      <BarChart
        title="Arrêts / absences spéciales par catégorie"
        data={charts.workAbsencesByCategory}
        emptyLabel="Aucun arrêt ni congé spécial sur la période."
      />
    </div>
  );
}
