import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  createReportingService,
} from "@/application/services/reporting-service";
import { canAccessHrReporting } from "@/domain/rules/permissions";
import { ReportingCharts } from "@/components/modules/reporting-charts";
import { ReportingExportCenter } from "@/components/modules/reporting-export-center";
import { ReportingFiltersForm } from "@/components/modules/reporting-filters";
import { PageHeader } from "@/components/ui/page-header";
import { getContainer } from "@/infrastructure/container";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatNumberFr(value: number, digits = 1): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--aster-border)] bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--aster-muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--aster-ink)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] text-[var(--aster-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canAccessHrReporting(session.role)) {
    redirect("/tableau-de-bord");
  }

  const params = await searchParams;
  const raw = {
    preset: first(params.preset) || "ce_mois",
    startDate: first(params.startDate),
    endDate: first(params.endDate),
    departmentId: first(params.departmentId),
    employeeId: first(params.employeeId),
    employmentStatus: first(params.employmentStatus),
    requestStatus: first(params.requestStatus),
  };

  const service = createReportingService(container);
  const dashboard = await service.getDashboard(session, raw);
  const { filters, kpis, charts, employees, departments } = dashboard;

  const filterProps = {
    preset: filters.preset,
    startDate: filters.startDate,
    endDate: filters.endDate,
    departmentId: filters.departmentId ?? "",
    employeeId: filters.employeeId ?? "",
    employmentStatus: filters.employmentStatus ?? "",
    requestStatus: filters.requestStatus ?? "",
  };

  // For filter dropdowns: show all departments; employees can be unscoped list
  const allEmployees = await container.hr.listEmployees({
    includeInactive: true,
  });

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Reporting RH"
        description="Indicateurs et exports Excel basés sur les données persistées ASTER (congés, télétravail, effectifs, recrutement, documents, récupération fériée)."
      />

      <Suspense fallback={null}>
        <ReportingFiltersForm
          departments={departments}
          employees={allEmployees}
          current={filterProps}
        />
      </Suspense>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--aster-ink)]">
          Indicateurs
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Kpi label="Effectif actif" value={String(kpis.effectifActif)} />
          <Kpi
            label="Nouveaux collaborateurs"
            value={String(kpis.nouveauxCollaborateurs)}
            hint="Embauches sur la période"
          />
          <Kpi
            label="Départs"
            value={String(kpis.departs)}
            hint="Sur la période"
          />
          <Kpi
            label="Collaborateurs inactifs"
            value={String(kpis.collaborateursInactifs)}
          />
          <Kpi
            label="Demandes de congés"
            value={String(kpis.demandesConges)}
            hint="Soumises sur la période"
          />
          <Kpi
            label="Absences approuvées"
            value={formatNumberFr(kpis.absencesApprouveesJours, 1)}
            hint={`${kpis.demandesCongesApprouvees} demande(s) · jours ouvrés`}
          />
          <Kpi
            label="Demandes en attente"
            value={String(kpis.demandesEnAttente)}
            hint="Congés, télétravail, férié, documents"
          />
          <Kpi
            label="Demandes de télétravail"
            value={String(kpis.demandesTeletravail)}
            hint="Créées sur la période"
          />
          <Kpi
            label="Documents RH en attente"
            value={String(kpis.demandesDocumentsEnAttente)}
          />
          <Kpi
            label="Recrutements en cours"
            value={String(kpis.recrutementsEnCours)}
          />
          <Kpi
            label="Récupération créditée"
            value={`${formatNumberFr(kpis.recuperationCrediteeHeures, 1)} h`}
            hint={`${formatNumberFr(kpis.recuperationCrediteeJours, 2)} j · ledger période`}
          />
          <Kpi
            label="Périmètre collaborateurs"
            value={String(employees.length)}
            hint="Après filtres département / statut"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--aster-ink)]">
          Visualisations
        </h2>
        <ReportingCharts charts={charts} />
      </section>

      <ReportingExportCenter filters={filterProps} />
    </div>
  );
}
