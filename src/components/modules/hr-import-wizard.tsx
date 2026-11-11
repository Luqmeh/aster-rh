"use client";

import { useRef, useState, useTransition } from "react";
import {
  downloadHrImportReportAction,
  downloadHrImportTemplateAction,
  executeHrImportAction,
  uploadHrImportAction,
  validateHrImportAction,
} from "@/app/actions/hr-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HrImportBatch } from "@/domain/types/hr-import";
import { useRouter } from "next/navigation";

function downloadBase64(fileName: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function HrImportWizard({
  canExecute,
  latestBatch,
}: {
  canExecute: boolean;
  latestBatch: HrImportBatch | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const batch = latestBatch;

  function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur d'import.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Modèles Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await downloadHrImportTemplateAction();
                downloadBase64(res.fileName, res.base64);
                setMessage(
                  "Modèle officiel ASTER_Modele_Import_RH_Maroc.xlsx téléchargé.",
                );
              })
            }
          >
            Télécharger le modèle officiel Excel
          </Button>
          <p className="text-xs text-[var(--aster-muted)]">
            Fichier unique : Collaborateurs, Soldes initiaux, Historique
            optionnel, Lisez-moi et Listes. Ne renommez pas les feuilles ni les
            colonnes.
          </p>
        </CardContent>
      </Card>

      {canExecute ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Téléverser le classeur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full text-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const file = fileRef.current?.files?.[0];
                  if (!file) throw new Error("Sélectionnez un fichier .xlsx.");
                  const fd = new FormData();
                  fd.set("file", file);
                  const res = await uploadHrImportAction(fd);
                  setMessage(`Lot ${res.batchId} analysé — prévisualisation prête.`);
                })
              }
            >
              Analyser et prévisualiser
            </Button>
            <p className="text-xs text-[var(--aster-muted)]">
              Formats acceptés : .xlsx · max 5 Mo. Les lignes invalides sont
              signalées et jamais ignorées silencieusement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-[10px] border border-[var(--aster-border)] bg-[var(--aster-surface-2)] px-4 py-3 text-sm text-[var(--aster-muted)]">
          Consultation seule — l&apos;exécution d&apos;import est réservée aux
          Ressources humaines.
        </p>
      )}

      {batch ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                3. Prévisualisation — lot {batch.id}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Fichier : <strong>{batch.fileName}</strong> · Statut :{" "}
                <strong>{batch.status}</strong>
              </p>
              <p>
                Feuilles : {batch.worksheetNames.join(", ") || "—"}
              </p>
              {batch.previewSummary ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat
                    label="Collaborateurs valides"
                    value={String(batch.previewSummary.validEmployeeRows)}
                  />
                  <Stat
                    label="Lignes invalides"
                    value={String(
                      batch.previewSummary.invalidEmployeeRows +
                        batch.previewSummary.invalidBalanceRows,
                    )}
                  />
                  <Stat
                    label="Nouveaux"
                    value={String(batch.previewSummary.newEmployees)}
                  />
                  <Stat
                    label="Soldes CP (j)"
                    value={String(batch.previewSummary.openingCpTotal)}
                  />
                  <Stat
                    label="Soldes RTT (j)"
                    value={String(batch.previewSummary.openingRttTotal)}
                  />
                  <Stat
                    label="Récup. (h)"
                    value={String(
                      batch.previewSummary.openingRecoveryDaysTotal,
                    )}
                  />
                </div>
              ) : null}

              {canExecute && batch.status === "awaiting_confirmation" ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  action={(fd) =>
                    run(async () => {
                      await validateHrImportAction(fd);
                      setMessage("Prévisualisation recalculée.");
                    })
                  }
                >
                  <input type="hidden" name="batchId" value={batch.id} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="updateExisting" value="true" />
                    Mettre à jour les fiches existantes
                  </label>
                  <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                    Recalculer
                  </Button>
                </form>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="py-1 pr-2">Ligne</th>
                      <th className="py-1 pr-2">Matricule</th>
                      <th className="py-1 pr-2">Action</th>
                      <th className="py-1 pr-2">Sévérité</th>
                      <th className="py-1">Messages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.employeeDrafts.slice(0, 30).map((r) => (
                      <tr key={`e-${r.rowNumber}`} className="border-b align-top">
                        <td className="py-1 pr-2">{r.rowNumber}</td>
                        <td className="py-1 pr-2 font-mono">{r.matricule}</td>
                        <td className="py-1 pr-2">{r.action}</td>
                        <td className="py-1 pr-2">{r.severity}</td>
                        <td className="py-1 text-[var(--aster-muted)]">
                          {r.messages.join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {batch.balanceDrafts.length > 0 ? (
                <div className="overflow-x-auto">
                  <p className="mb-1 font-medium">Soldes d&apos;ouverture</p>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1 pr-2">Ligne</th>
                        <th className="py-1 pr-2">Matricule</th>
                        <th className="py-1 pr-2">CP</th>
                        <th className="py-1 pr-2">RTT</th>
                        <th className="py-1 pr-2">Type</th>
                        <th className="py-1 pr-2">Récup. h</th>
                        <th className="py-1">Messages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.balanceDrafts.slice(0, 30).map((r) => (
                        <tr key={`b-${r.rowNumber}`} className="border-b align-top">
                          <td className="py-1 pr-2">{r.rowNumber}</td>
                          <td className="py-1 pr-2 font-mono">{r.matricule}</td>
                          <td className="py-1 pr-2">{r.cpDays ?? "—"}</td>
                          <td className="py-1 pr-2">{r.rttDays ?? "—"}</td>
                          <td className="py-1 pr-2">{r.balanceType ?? "—"}</td>
                          <td className="py-1 pr-2">{r.recoveryHours ?? "—"}</td>
                          <td className="py-1 text-[var(--aster-muted)]">
                            {r.severity} · {r.messages.join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {canExecute && batch.status === "awaiting_confirmation" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">4. Confirmation RH</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  action={(fd) =>
                    run(async () => {
                      await executeHrImportAction(fd);
                      setMessage("Import exécuté — voir le rapport ci-dessous.");
                    })
                  }
                >
                  <input type="hidden" name="batchId" value={batch.id} />
                  <label className="block text-sm">
                    Saisir <strong>IMPORTER</strong> pour confirmer
                    <input
                      name="confirmationPhrase"
                      className="mt-1 w-full max-w-xs rounded border bg-background px-2 py-1.5"
                      required
                      autoComplete="off"
                    />
                  </label>
                  <Button type="submit" size="sm" disabled={pending}>
                    Exécuter l&apos;import contrôlé
                  </Button>
                  <p className="text-xs text-[var(--aster-muted)]">
                    Les soldes sont écrits en ouvertures ledger append-only — pas
                    de recalcul d&apos;acquisition historique.
                  </p>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {batch.executionReport ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">5. Rapport d&apos;import</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Lot : <span className="font-mono">{batch.executionReport.batchId}</span>{" "}
                  · Exécuté le{" "}
                  {new Date(batch.executionReport.executedAt).toLocaleString("fr-FR")}
                </p>
                <p>
                  Créés : {batch.executionReport.employeesCreated} · Mis à jour :{" "}
                  {batch.executionReport.employeesUpdated} · Soldes importés :{" "}
                  {batch.executionReport.balancesImported}
                </p>
                <p>
                  Comptes : créés {batch.executionReport.accountsCreated} ·
                  existants {batch.executionReport.accountsExisting} · en attente{" "}
                  {batch.executionReport.accountsPending} · échecs{" "}
                  {batch.executionReport.accountsFailed}
                </p>
                <p>
                  Rejets : {batch.executionReport.rejectedRows} · Avertissements :{" "}
                  {batch.executionReport.warningRows}
                </p>
                {batch.executionReport.provisioningResults.length > 0 ? (
                  <div className="overflow-x-auto">
                    <p className="mb-1 font-medium">Provisioning comptes</p>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="py-1 pr-2">Matricule</th>
                          <th className="py-1 pr-2">Statut</th>
                          <th className="py-1">Détail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batch.executionReport.provisioningResults.map((p) => (
                          <tr key={`${p.matricule}-${p.status}`} className="border-b">
                            <td className="py-1 pr-2 font-mono">{p.matricule}</td>
                            <td className="py-1 pr-2">{p.status}</td>
                            <td className="py-1 text-[var(--aster-muted)]">
                              {p.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await downloadHrImportReportAction(batch.id);
                      downloadBase64(res.fileName, res.base64);
                      setMessage("Rapport de réconciliation téléchargé.");
                    })
                  }
                >
                  Télécharger le rapport Excel
                </Button>
                {batch.executionReport.manualIntervention.length > 0 ? (
                  <ul className="list-disc pl-5 text-[var(--aster-muted)]">
                    {batch.executionReport.manualIntervention.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1 pr-2">Matricule</th>
                        <th className="py-1 pr-2">Excel CP</th>
                        <th className="py-1 pr-2">ASTER CP</th>
                        <th className="py-1 pr-2">Excel RTT</th>
                        <th className="py-1 pr-2">ASTER RTT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.executionReport.reconciliation.map((r, idx) => (
                        <tr
                          key={`${r.matricule}-recon-${idx}`}
                          className="border-b"
                        >
                          <td className="py-1 pr-2 font-mono">{r.matricule}</td>
                          <td className="py-1 pr-2">{r.excelCp ?? "—"}</td>
                          <td className="py-1 pr-2">{r.asterCp ?? "—"}</td>
                          <td className="py-1 pr-2">{r.excelRtt ?? "—"}</td>
                          <td className="py-1 pr-2">{r.asterRtt ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {message ? (
        <p className="text-sm text-[var(--aster-success)]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--aster-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {batch?.errorMessage ? (
        <p className="text-sm text-[var(--aster-danger)]">{batch.errorMessage}</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--aster-border)] px-3 py-2">
      <p className="text-xs text-[var(--aster-muted)]">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
