import {
  decideCarryoverAction,
  postAccrualBatchAction,
  previewAccrualBatchAction,
  requestCarryoverAction,
} from "@/app/actions/entitlement";
import { createEntitlementService } from "@/application/services/entitlement-service";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessHrAdministration } from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";
import { fullName } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DroitsCongesPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canAccessHrAdministration(session.role)) {
    redirect("/tableau-de-bord");
  }

  const leaveLedger = createLeaveLedgerService(container);
  const entitlement = createEntitlementService({
    hr: container.hr,
    leaveLedger,
  });

  const [employees, preview, batches, carryovers, policies] = await Promise.all([
    container.hr.listEmployees(),
    entitlement.previewMonthlyAccruals(session, { year: 2026, month: 11 }),
    Promise.resolve(entitlement.listBatches(session)),
    Promise.resolve(entitlement.listCarryovers(session)),
    Promise.resolve(entitlement.listPolicyVersions()),
  ]);

  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const needingReview = preview.lines.filter(
    (l) =>
      l.calculationStatus === "requires_hr_validation" ||
      l.calculationStatus === "missing_employment_information" ||
      l.calculationStatus === "missing_policy_configuration",
  );
  const special = entitlement.listSpecialLeavePolicies();
  const rttTargets = entitlement.rttUsageTargets();

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Droits à congés & acquisitions"
        description="CAP Maroc : minimum statutaire 1,5 j/mois + politique entreprise 2 j/mois (total, non cumulés). Preview sans posting auto tant que RH n’a pas confirmé (hr_configured). Ledger append-only."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/administration">Retour administration</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview novembre 2026</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Lignes : {preview.lines.length} — postables :{" "}
              {preview.postableCount} — bloquées / à revoir :{" "}
              {preview.blockedCount}
            </p>
            <form action={previewAccrualBatchAction}>
              <input type="hidden" name="year" value="2026" />
              <input type="hidden" name="month" value="11" />
              <Button type="submit" size="sm">
                Créer un lot preview
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RTT / avantages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Pas de RTT statutaire Maroc auto-configuré. Soldes RTT ledger
              historiques éventuels conservés.
            </p>
            <p className="text-muted-foreground">
              Cibles d&apos;usage FR (réf. historique) :{" "}
              {rttTargets.map((t) => `${t.label} ${t.days}j`).join(" · ")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">À valider RH</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{needingReview.length} ligne(s)</p>
            <p className="text-muted-foreground">
              Temps partiel, mois partiels, politique MA non hr_configured, etc.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Politiques versionnées</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-b align-top">
                  <td className="py-2 pr-3 font-mono text-xs">{p.policyCode}</td>
                  <td className="py-2 pr-3">{p.validationStatus}</td>
                  <td className="py-2 pr-3 text-xs">{p.sourceReference}</td>
                  <td className="py-2 text-muted-foreground">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Prévisualisation accruals (nov. 2026)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-2">Collaborateur</th>
                <th className="py-2 pr-2">Compte</th>
                <th className="py-2 pr-2">Qté</th>
                <th className="py-2 pr-2">Statut</th>
                <th className="py-2">Explication</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.slice(0, 40).map((line) => {
                const emp = byId[line.employeeId];
                return (
                  <tr key={line.idempotencyKey} className="border-b align-top">
                    <td className="py-2 pr-2">
                      {emp ? fullName(emp.firstName, emp.lastName) : line.employeeId}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {line.account}
                    </td>
                    <td className="py-2 pr-2">{line.quantity}</td>
                    <td className="py-2 pr-2 text-xs">
                      {line.calculationStatus}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {line.explanation}
                      {line.warnings.length > 0 ? (
                        <ul className="mt-1 list-disc pl-4">
                          {line.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {preview.lines.length > 40 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Affichage limité à 40 lignes — le lot preview contient le détail
              complet.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lots d&apos;acquisition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun lot. Créez d&apos;abord une preview.
            </p>
          ) : (
            batches.map((batch) => (
              <div
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {batch.label} — {batch.status}
                  </p>
                  <p className="text-muted-foreground">
                    {batch.lines.length} lignes · postables calculées :{" "}
                    {
                      batch.lines.filter(
                        (l) =>
                          l.calculationStatus === "calculated" &&
                          l.quantity > 0,
                      ).length
                    }
                  </p>
                </div>
                {batch.status === "preview" ? (
                  <form action={postAccrualBatchAction}>
                    <input type="hidden" name="batchId" value={batch.id} />
                    <Button type="submit" size="sm">
                      Poster les lignes validées
                    </Button>
                  </form>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Posté le {batch.postedAt}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Entrées de calcul (échantillon preview)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <p className="mb-3 text-sm text-muted-foreground">
            Données utilisées pour art. 231 / 238 — les absences = données
            manquantes bloquent le posting automatique.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-2">Collaborateur</th>
                <th className="py-2 pr-2">Embauche</th>
                <th className="py-2 pr-2">Naissance</th>
                <th className="py-2 pr-2">TP</th>
                <th className="py-2 pr-2">h/sem</th>
                <th className="py-2">Secteur</th>
              </tr>
            </thead>
            <tbody>
              {employees.slice(0, 12).map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-2 pr-2">
                    {fullName(e.firstName, e.lastName)}
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs">{e.hireDate}</td>
                  <td className="py-2 pr-2 font-mono text-xs">
                    {e.birthDate ?? "— manquant"}
                  </td>
                  <td className="py-2 pr-2">{e.isPartTime ? "oui" : "non"}</td>
                  <td className="py-2 pr-2">
                    {e.weeklyContractHours ?? "—"}
                  </td>
                  <td className="py-2 text-xs">{e.activitySector}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Report / fractionnement (art. 240)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cumul ou fractionnement sur deux années civiles consécutives
            uniquement après accord salarié–employeur (mention registre des
            congés). Pas d&apos;expiry automatique statutaire. Pas de règle
            française de report « 5 j ».
          </p>
          <form
            action={requestCarryoverAction}
            className="grid gap-2 md:grid-cols-2"
          >
            <label className="text-sm">
              Collaborateur
              <select
                name="employeeId"
                className="mt-1 w-full rounded border bg-background px-2 py-1.5"
                required
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {fullName(e.firstName, e.lastName)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Jours demandés
              <input
                name="requestedDays"
                type="number"
                step="0.5"
                min="0.5"
                defaultValue={3}
                className="mt-1 w-full rounded border bg-background px-2 py-1.5"
                required
              />
            </label>
            <label className="text-sm">
              Année source
              <input
                name="sourcePeriodKey"
                defaultValue="2025"
                className="mt-1 w-full rounded border bg-background px-2 py-1.5"
                required
              />
            </label>
            <label className="text-sm">
              Année cible
              <input
                name="targetPeriodKey"
                defaultValue="2026"
                className="mt-1 w-full rounded border bg-background px-2 py-1.5"
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                name="hasMutualAgreement"
                value="true"
                required
              />
              Accord mutuel salarié–employeur (art. 240) confirmé
            </label>
            <label className="text-sm md:col-span-2">
              Motif / référence registre
              <input
                name="exceptionReason"
                className="mt-1 w-full rounded border bg-background px-2 py-1.5"
                placeholder="Réf. accord / registre des congés"
                required
              />
            </label>
            <label className="text-sm">
              Plan congés jusqu&apos;au
              <input
                name="leavePlanThrough"
                type="date"
                className="mt-1 w-full rounded border bg-background px-2 py-1.5"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" size="sm">
                Enregistrer demande (en attente)
              </Button>
            </div>
          </form>

          {carryovers.map((c) => (
            <div key={c.id} className="border-t pt-3 text-sm">
              <p>
                {byId[c.employeeId]
                  ? fullName(byId[c.employeeId].firstName, byId[c.employeeId].lastName)
                  : c.employeeId}{" "}
                — {c.requestedDays} j — {c.status}
              </p>
              {c.status === "en_attente_validation" ? (
                <form action={decideCarryoverAction} className="mt-2 flex gap-2">
                  <input type="hidden" name="requestId" value={c.id} />
                  <input
                    name="decisionNote"
                    placeholder="Motif décision"
                    className="flex-1 rounded border bg-background px-2 py-1.5"
                    required
                  />
                  <Button
                    type="submit"
                    name="approve"
                    value="true"
                    size="sm"
                  >
                    Approuver &amp; poster
                  </Button>
                  <Button
                    type="submit"
                    name="approve"
                    value="false"
                    size="sm"
                    variant="secondary"
                  >
                    Refuser
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Congés spéciaux (événementiels)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <p className="mb-3 text-sm text-muted-foreground">
            Pas de solde cumulatif ledger — plafonds par événement / année civile
            selon le guide. Justificatifs sensibles réservés RH.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-2">Événement</th>
                <th className="py-2 pr-2">Max</th>
                <th className="py-2 pr-2">Source</th>
                <th className="py-2">Justificatif</th>
              </tr>
            </thead>
            <tbody>
              {special.map((s) => (
                <tr key={s.category} className="border-b align-top">
                  <td className="py-2 pr-2">{s.label}</td>
                  <td className="py-2 pr-2">
                    {s.maxDays == null ? "Revue RH" : `${s.maxDays} j`}
                  </td>
                  <td className="py-2 pr-2 text-xs">{s.source}</td>
                  <td className="py-2 text-muted-foreground">
                    {s.supportingDocumentHint}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
