"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { exportHrReportAction } from "@/app/actions/reporting";
import {
  REPORT_EXPORT_KEYS,
  reportExportLabel,
  type ReportExportKey,
} from "@/domain/rules/reporting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DESCRIPTIONS: Record<ReportExportKey, string> = {
  conges_mois:
    "Demandes de congés sur la période : statut, durée, décision. Les absences confirmées sont les seules approuvées.",
  planning_absences:
    "Absences approuvées à venir ou en cours — planning opérationnel par département.",
  soldes:
    "Soldes CP, RTT annuels et récupération compensatrice (distincte) issus des soldes persistés.",
  teletravail:
    "Jours demandés / approuvés / en attente / refusés par mois et collaborateur.",
  annuaire:
    "Effectifs : identité, département, poste, statut, rôle, dates d'embauche / départ.",
  recrutement:
    "Pipeline candidats (sans CV, notes RH ni URLs privées).",
  documents:
    "Demandes documentaires RH (sans contenu fichier ni URL signée).",
  travail_ferie:
    "Travail jours fériés : heures planifiées / déclarées / confirmées et crédits de récupération.",
  lifecycle:
    "Onboarding et cycle de vie (sans secrets d'authentification).",
  historique:
    "Historique consolidé congés, télétravail et travail férié, avec types de demande distincts.",
  arrets_absences:
    "Arrêts et congés spéciaux (statuts, retours, visite reprise, mois paie cible) — sans certificats ni notes médicales.",
};

export function ReportingExportCenter({
  filters,
}: {
  filters: {
    preset: string;
    startDate: string;
    endDate: string;
    departmentId: string;
    employeeId: string;
    employmentStatus: string;
    requestStatus: string;
  };
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function download(key: ReportExportKey) {
    setMessage(null);
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      const result = await exportHrReportAction({
        reportKey: key,
        preset: filters.preset,
        startDate: filters.startDate,
        endDate: filters.endDate,
        departmentId: filters.departmentId || null,
        employeeId: filters.employeeId || null,
        employmentStatus: filters.employmentStatus || null,
        requestStatus: filters.requestStatus || null,
      });
      setPendingKey(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(
        result.rowCount === 0
          ? `${result.filename} téléchargé (aucune ligne — fichier d'en-têtes).`
          : `${result.filename} téléchargé (${result.rowCount} ligne${result.rowCount > 1 ? "s" : ""}).`,
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Centre d&apos;exports Excel
        </CardTitle>
        <p className="text-[13px] text-[var(--aster-muted)]">
          Les exports reprennent les filtres actifs ({filters.startDate} →{" "}
          {filters.endDate}
          {filters.departmentId ? " · département filtré" : ""}
          {filters.employeeId ? " · collaborateur filtré" : ""}). Format .xlsx
          généré côté serveur.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {message ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {error}
          </p>
        ) : null}
        <ul className="divide-y divide-[var(--aster-border)] rounded-lg border border-[var(--aster-border)]">
          {REPORT_EXPORT_KEYS.map((key) => {
            const busy = pending && pendingKey === key;
            return (
              <li
                key={key}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--aster-ink)]">
                    {reportExportLabel(key)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--aster-muted)]">
                    {DESCRIPTIONS[key]}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => download(key)}
                  className="shrink-0"
                >
                  {busy ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-4 w-4" />
                  )}
                  Exporter Excel
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
