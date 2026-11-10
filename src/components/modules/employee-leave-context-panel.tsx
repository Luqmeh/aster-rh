import Link from "next/link";
import type {
  LeaveRequestApprovalContext,
  WorkAbsenceApprovalContext,
} from "@/application/services/leave-approval-context-service";
import {
  workAbsenceCategoryLabel,
  workAbsenceStatusLabel,
} from "@/domain/rules/work-absence";
import { formatDateFr } from "@/lib/utils";

type Props = {
  context: LeaveRequestApprovalContext | WorkAbsenceApprovalContext;
  compact?: boolean;
};

export function EmployeeLeaveContextPanel({ context, compact }: Props) {
  return (
    <aside
      className={`rounded-[10px] border border-[var(--aster-border)] bg-[var(--aster-surface-2)]/70 p-3 ${
        compact ? "mt-2" : "mt-3"
      }`}
      aria-label="Contexte collaborateur"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--aster-ink)]">
            {context.employee.fullName}
          </p>
          <p className="text-xs text-[var(--aster-muted)]">
            {context.employee.jobTitle}
            {context.employee.departmentName
              ? ` · ${context.employee.departmentName}`
              : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--aster-muted)]">
            {context.employee.employeeId} · {context.employee.employmentStatus}
          </p>
        </div>
        <Link
          href={context.employee.profileHref}
          className="text-[11px] font-medium text-[var(--aster-accent)] underline-offset-2 hover:underline"
        >
          Voir la fiche
        </Link>
      </div>

      {context.kind === "leave_request" ? (
        <LeaveBalanceBlock context={context} />
      ) : (
        <AbsenceContextBlock context={context} />
      )}
    </aside>
  );
}

function LeaveBalanceBlock({
  context,
}: {
  context: LeaveRequestApprovalContext;
}) {
  const { balance, lastTaken, history, recovery } = context;

  return (
    <div className="mt-3 space-y-3">
      {!balance.tracked || balance.untrackedLabel ? (
        <p className="rounded-[8px] border border-dashed border-[var(--aster-border-strong)] px-2.5 py-2 text-xs text-[var(--aster-muted)]">
          {balance.untrackedLabel ?? "Solde non suivi"}
          <span className="mt-1 block">
            Durée de la demande :{" "}
            <strong className="text-[var(--aster-ink)]">
              {balance.requestDays} j
            </strong>
          </span>
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Metric
            label="Droit / acquis"
            value={formatDays(balance.entitlement)}
          />
          <Metric
            label="Déjà consommé (solde)"
            value={formatDays(balance.consumedRecorded)}
          />
          <Metric
            label="Disponible maintenant"
            value={formatDays(balance.availableNow)}
            emphasize
          />
          <Metric
            label="Après approbation"
            value={formatDays(balance.projectedAvailableAfterApproval)}
            warn={balance.insufficientForRequest}
            emphasize
          />
          <Metric
            label="Durée demandée"
            value={formatDays(balance.requestDays)}
          />
          <Metric
            label="Autres demandes en attente"
            value={formatDays(balance.otherPendingReservedDays)}
            hint="Non déduites du disponible (pas de réservation au dépôt)"
          />
        </div>
      )}

      {balance.insufficientForRequest ? (
        <p
          role="status"
          className="rounded-[8px] border border-[var(--aster-warning)]/50 bg-[var(--aster-warning-bg)]/50 px-2.5 py-2 text-xs text-[var(--aster-ink)]"
        >
          Solde insuffisant pour cette demande selon le solde enregistré — à
          prendre en compte avant décision.
        </p>
      ) : null}

      {balance.otherPendingReservedDays > 0 && balance.tracked ? (
        <p className="text-[11px] text-[var(--aster-muted)]">
          Autres réservations pending ({balance.leaveTypeLabel}) :{" "}
          {balance.otherPendingReservedDays} j — distinctes du disponible
          actuel.
        </p>
      ) : null}

      {recovery ? (
        <div className="rounded-[8px] border border-[var(--aster-border)] bg-white/70 px-2.5 py-2 text-xs">
          <p className="font-medium text-[var(--aster-ink)]">
            Crédits récupération (année)
          </p>
          <p className="mt-1 text-[var(--aster-muted)]">
            Confirmés : {recovery.hoursConfirmedTotal} h /{" "}
            {recovery.daysCreditedTotal} j · Solde récup. restant :{" "}
            {formatDays(recovery.balanceRestants)} · Pris :{" "}
            {formatDays(recovery.balancePris)}
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--aster-muted)]">
          Dernier congé pris
        </p>
        {lastTaken ? (
          <p className="mt-1 text-xs text-[var(--aster-ink)]">
            {lastTaken.typeLabel} · {formatDateFr(lastTaken.startDate)} →{" "}
            {formatDateFr(lastTaken.endDate)} · {lastTaken.daysCount} j
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--aster-muted)]">
            Aucun congé pris enregistré.
          </p>
        )}
      </div>

      {history.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-[11px] font-medium text-[var(--aster-accent)]">
            Historique récent ({history.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {history.map((item) => (
              <li
                key={item.id}
                className="rounded-[7px] border border-[var(--aster-border)] bg-white/60 px-2 py-1.5 text-[11px] text-[var(--aster-ink)]"
              >
                {item.typeLabel} · {formatDateFr(item.startDate)} →{" "}
                {formatDateFr(item.endDate)} · {item.daysCount} j
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function AbsenceContextBlock({
  context,
}: {
  context: WorkAbsenceApprovalContext;
}) {
  return (
    <div className="mt-3 space-y-3">
      <p className="rounded-[8px] border border-dashed border-[var(--aster-border-strong)] px-2.5 py-2 text-xs text-[var(--aster-muted)]">
        {context.balanceLabel}
        <span className="mt-1 block text-[var(--aster-ink)]">
          {context.categoryLabel} · famille {context.family}
        </span>
      </p>

      {context.specialLeave ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Metric
            label="Plafond indicatif"
            value={
              context.specialLeave.maxDays == null
                ? "Non chiffré"
                : `${context.specialLeave.maxDays} j`
            }
          />
          <Metric
            label="Déjà utilisé (année)"
            value={`${context.specialLeave.usedDaysThisYear} j`}
          />
          <Metric
            label="Durée demandée"
            value={`${context.specialLeave.requestDays} j`}
          />
          <Metric
            label="Total si validé"
            value={`${context.specialLeave.projectedUsedAfterApproval} j`}
            warn={
              context.specialLeave.maxDays != null &&
              context.specialLeave.projectedUsedAfterApproval >
                context.specialLeave.maxDays
            }
          />
          {context.specialLeave.message ? (
            <p className="sm:col-span-2 text-[11px] text-[var(--aster-muted)]">
              {context.specialLeave.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {context.family === "arret" ? (
        <div className="rounded-[8px] border border-[var(--aster-border)] bg-white/70 px-2.5 py-2 text-xs text-[var(--aster-muted)]">
          <p className="font-medium text-[var(--aster-ink)]">
            Suivi opérationnel (sans données médicales)
          </p>
          <p className="mt-1">
            Retour prévu :{" "}
            {context.expectedReturnDate
              ? formatDateFr(context.expectedReturnDate)
              : "—"}
            {" · "}
            Retour réel :{" "}
            {context.actualReturnDate
              ? formatDateFr(context.actualReturnDate)
              : "—"}
          </p>
          {context.returnVisitStatus ? (
            <p className="mt-0.5">
              Visite de reprise : {context.returnVisitStatus}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--aster-muted)]">
          Dernière absence clôturée
        </p>
        {context.lastCompleted ? (
          <p className="mt-1 text-xs text-[var(--aster-ink)]">
            {workAbsenceCategoryLabel(context.lastCompleted.category)} ·{" "}
            {formatDateFr(context.lastCompleted.startDate)} →{" "}
            {formatDateFr(context.lastCompleted.endDate)} ·{" "}
            {context.lastCompleted.daysCount} j
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--aster-muted)]">
            Aucune absence clôturée enregistrée.
          </p>
        )}
      </div>

      {context.history.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-[11px] font-medium text-[var(--aster-accent)]">
            Historique absences ({context.history.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {context.history.map((item) => (
              <li
                key={item.id}
                className="rounded-[7px] border border-[var(--aster-border)] bg-white/60 px-2 py-1.5 text-[11px]"
              >
                {workAbsenceCategoryLabel(item.category)} ·{" "}
                {formatDateFr(item.startDate)} → {formatDateFr(item.endDate)} ·{" "}
                {item.daysCount} j · {workAbsenceStatusLabel(item.status)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  emphasize,
  warn,
  hint,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  warn?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`rounded-[8px] border px-2.5 py-2 ${
        warn
          ? "border-[var(--aster-warning)]/50 bg-[var(--aster-warning-bg)]/40"
          : "border-[var(--aster-border)] bg-white/70"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--aster-muted)]">
        {label}
      </p>
      <p
        className={`mt-0.5 tabular-nums ${
          emphasize
            ? "text-sm font-semibold text-[var(--aster-ink)]"
            : "text-xs font-medium text-[var(--aster-ink)]"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-[var(--aster-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value} j`;
}
