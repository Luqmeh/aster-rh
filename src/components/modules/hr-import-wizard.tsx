"use client";

import { useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  cancelHrImportAction,
  downloadHrImportReportAction,
  downloadHrImportTemplateAction,
  executeHrImportAction,
  uploadHrImportAction,
  validateHrImportAction,
  type HrImportActionResult,
} from "@/app/actions/hr-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  canCancelImportBatch,
  type HrImportBatch,
} from "@/domain/types/hr-import";
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

function assertOk(res: HrImportActionResult): asserts res is Extract<
  HrImportActionResult,
  { ok: true }
> {
  if (!res.ok) {
    throw new Error(res.message);
  }
}

export function HrImportWizard({
  canExecute,
  activeBatch,
  recentBatches,
}: {
  canExecute: boolean;
  activeBatch: HrImportBatch | null;
  recentBatches: HrImportBatch[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const batch = activeBatch;
  const canRecalculate =
    canExecute &&
    (batch?.status === "awaiting_confirmation" ||
      batch?.status === "validated" ||
      batch?.status === "failed");
  const canConfirm = canExecute && batch?.status === "awaiting_confirmation";
  const canAbandon =
    canExecute && batch != null && canCancelImportBatch(batch.status);

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
                assertOk(res);
                downloadBase64(res.fileName!, res.base64!);
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
            <CardTitle className="text-base">
              2. {batch ? "Remplacer le fichier" : "Téléverser le classeur"}
            </CardTitle>
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
                  assertOk(res);
                  setMessage(
                    batch
                      ? `Fichier remplacé — lot ${res.batchId} analysé.`
                      : `Lot ${res.batchId} analysé — prévisualisation prête.`,
                  );
                })
              }
            >
              {batch ? "Remplacer et prévisualiser" : "Analyser et prévisualiser"}
            </Button>
            <p className="text-xs text-[var(--aster-muted)]">
              Formats acceptés : .xlsx · max 5 Mo. Les lignes invalides sont
              signalées et jamais ignorées silencieusement.
              {batch
                ? " Un nouveau téléversement crée un nouveau lot ; abandonnez l'ancien si besoin."
                : null}
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
              <p>Feuilles : {batch.worksheetNames.join(", ") || "—"}</p>
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

              {canRecalculate ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  action={(fd) =>
                    run(async () => {
                      const res = await validateHrImportAction(fd);
                      assertOk(res);
                      setMessage("Prévisualisation recalculée.");
                    })
                  }
                >
                  <input type="hidden" name="batchId" value={batch.id} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="updateExisting" value="true" />
                    Mettre à jour les fiches existantes
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                  >
                    Recalculer
                  </Button>
                </form>
              ) : null}

              {batch.status === "validated" ? (
                <p className="text-sm text-[var(--aster-danger)]" role="status">
                  Confirmation bloquée tant que des lignes invalides restent
                  présentes. Corrigez le fichier puis re-téléversez ou
                  recalculez.
                </p>
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
                      <tr
                        key={`e-${r.rowNumber}`}
                        className="border-b align-top"
                      >
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
                        <tr
                          key={`b-${r.rowNumber}`}
                          className="border-b align-top"
                        >
                          <td className="py-1 pr-2">{r.rowNumber}</td>
                          <td className="py-1 pr-2 font-mono">{r.matricule}</td>
                          <td className="py-1 pr-2">{r.cpDays ?? "—"}</td>
                          <td className="py-1 pr-2">{r.rttDays ?? "—"}</td>
                          <td className="py-1 pr-2">{r.balanceType ?? "—"}</td>
                          <td className="py-1 pr-2">
                            {r.recoveryHours ?? "—"}
                          </td>
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

          {canConfirm || canAbandon ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">4. Décision RH</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canConfirm ? (
                  <form
                    className="space-y-3"
                    action={(fd) =>
                      run(async () => {
                        const res = await executeHrImportAction(fd);
                        assertOk(res);
                        setMessage(
                          "Import exécuté — voir le rapport ci-dessous.",
                        );
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
                      Confirmer l&apos;import
                    </Button>
                    <p className="text-xs text-[var(--aster-muted)]">
                      Les soldes sont écrits en ouvertures ledger append-only —
                      pas de recalcul d&apos;acquisition historique.
                    </p>
                  </form>
                ) : null}

                {canAbandon ? (
                  <div className="border-t border-[var(--aster-border)] pt-4">
                    <p className="mb-2 text-sm text-[var(--aster-muted)]">
                      Vous pouvez abandonner ce lot sans créer de fiches, comptes
                      ni soldes.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      onClick={() => setCancelOpen(true)}
                    >
                      Abandonner l&apos;import
                    </Button>
                  </div>
                ) : null}
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
                  Lot :{" "}
                  <span className="font-mono">
                    {batch.executionReport.batchId}
                  </span>{" "}
                  · Exécuté le{" "}
                  {new Date(batch.executionReport.executedAt).toLocaleString(
                    "fr-FR",
                  )}
                </p>
                <p>
                  Créés : {batch.executionReport.employeesCreated} · Mis à jour :{" "}
                  {batch.executionReport.employeesUpdated} · Soldes importés :{" "}
                  {batch.executionReport.balancesImported}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await downloadHrImportReportAction(batch.id);
                      assertOk(res);
                      downloadBase64(res.fileName!, res.base64!);
                      setMessage("Rapport de réconciliation téléchargé.");
                    })
                  }
                >
                  Télécharger le rapport Excel
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {recentBatches.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des lots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 pr-2">Lot</th>
                    <th className="py-1 pr-2">Fichier</th>
                    <th className="py-1 pr-2">Statut</th>
                    <th className="py-1">Créé</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBatches.map((b) => (
                    <tr key={b.id} className="border-b">
                      <td className="py-1 pr-2 font-mono">{b.id}</td>
                      <td className="py-1 pr-2">{b.fileName}</td>
                      <td className="py-1 pr-2">{b.status}</td>
                      <td className="py-1">
                        {new Date(b.createdAt).toLocaleString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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

      <Dialog.Root open={cancelOpen} onOpenChange={setCancelOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-[var(--aster-border)] bg-white p-5 shadow-lg">
            <Dialog.Title className="text-base font-semibold text-[var(--aster-ink)]">
              Abandonner l&apos;import ?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-[var(--aster-muted)]">
              Aucun collaborateur, compte ASTER ni solde d&apos;ouverture ne sera
              créé. Le classeur temporaire sera purgé ; le lot restera visible
              dans l&apos;historique avec le statut{" "}
              <strong>cancelled</strong>.
            </Dialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" size="sm" variant="secondary" disabled={pending}>
                  Continuer l&apos;import
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={pending || !batch}
                onClick={() =>
                  run(async () => {
                    if (!batch) return;
                    const fd = new FormData();
                    fd.set("batchId", batch.id);
                    const res = await cancelHrImportAction(fd);
                    assertOk(res);
                    setCancelOpen(false);
                    setMessage(
                      "Import abandonné — aucun enregistrement créé. Vous pouvez démarrer un nouvel import.",
                    );
                  })
                }
              >
                Confirmer l&apos;abandon
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
