import { formatScaled, toScaled } from "@/domain/rules/leave-decimal";
import {
  assertPositiveQuantity,
  buildOpeningEntriesFromBalance,
  computeAccountBalance,
  leaveTypeToLedgerAccount,
  OPENING_SOURCE_KIND,
  TRACKED_LEDGER_ACCOUNTS,
} from "@/domain/rules/leave-ledger-balance";
import { moroccoToday } from "@/domain/rules/reporting";
import {
  canAccessHrAdministration,
  hasPermission,
} from "@/domain/rules/permissions";
import type { LeaveBalance, LeaveRequest, LeaveType } from "@/domain/types/hr";
import type {
  AccountBalanceSnapshot,
  LeaveLedgerAccount,
  LeaveLedgerEntry,
} from "@/domain/types/leave-ledger";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

const DEFAULT_YEAR = 2026;
const OPENING_EFFECTIVE_DATE = "2026-01-01";

function snapshotToLeaveBalanceFields(
  snapshots: AccountBalanceSnapshot[],
): Partial<LeaveBalance> {
  const byAccount = Object.fromEntries(
    snapshots.map((s) => [s.account, s]),
  ) as Record<LeaveLedgerAccount, AccountBalanceSnapshot | undefined>;
  const cp = byAccount.conges_payes;
  const rtt = byAccount.rtt;
  const rec = byAccount.recuperation;
  return {
    congesPayesAcquis: cp?.totalCredited ?? 0,
    congesPayesPris: cp?.totalConsumed ?? 0,
    congesPayesRestants: cp?.ledgerBalance ?? 0,
    rttAcquis: rtt?.totalCredited ?? 0,
    rttPris: rtt?.totalConsumed ?? 0,
    rttRestants: rtt?.ledgerBalance ?? 0,
    recoveryDaysAcquis: rec?.totalCredited ?? 0,
    recoveryDaysPris: rec?.totalConsumed ?? 0,
    recoveryDaysRestants: rec?.ledgerBalance ?? 0,
  };
}

export function createLeaveLedgerService(deps: { hr: HrRepository }) {
  return {
    /**
     * Backfill idempotent : écritures d'ouverture depuis LeaveBalance existant.
     * N'invente pas d'historique de mouvements individuels.
     */
    async backfillOpeningBalancesFromSnapshots(options?: {
      year?: number;
      effectiveDate?: string;
    }): Promise<{ created: number; skipped: number }> {
      const year = options?.year ?? DEFAULT_YEAR;
      const effectiveDate = options?.effectiveDate ?? OPENING_EFFECTIVE_DATE;
      const balances = await deps.hr.listLeaveBalances(year);
      let created = 0;
      let skipped = 0;

      for (const balance of balances) {
        const accounts: Array<{
          account: LeaveLedgerAccount;
          acquis: number;
          pris: number;
          restants: number;
        }> = [
          {
            account: "conges_payes",
            acquis: balance.congesPayesAcquis,
            pris: balance.congesPayesPris,
            restants: balance.congesPayesRestants,
          },
          {
            account: "rtt",
            acquis: balance.rttAcquis,
            pris: balance.rttPris,
            restants: balance.rttRestants,
          },
          {
            account: "recuperation",
            acquis: balance.recoveryDaysAcquis,
            pris: balance.recoveryDaysPris,
            restants: balance.recoveryDaysRestants,
          },
        ];

        for (const row of accounts) {
          const drafts = buildOpeningEntriesFromBalance({
            employeeId: balance.employeeId,
            year,
            account: row.account,
            acquis: row.acquis,
            pris: row.pris,
            restants: row.restants,
            effectiveDate,
          });
          for (const draft of drafts) {
            const result = await deps.hr.appendLeaveLedgerEntry({
              employeeId: balance.employeeId,
              ...draft,
            });
            if (result.created) created += 1;
            else skipped += 1;
          }
        }
      }

      return { created, skipped };
    },

    async ensureBackfill(year = DEFAULT_YEAR): Promise<void> {
      const existing = await deps.hr.listLeaveLedgerEntries({
        year,
      });
      const hasOpening = existing.some(
        (e) => e.sourceKind === OPENING_SOURCE_KIND,
      );
      if (!hasOpening) {
        await this.backfillOpeningBalancesFromSnapshots({ year });
      }
    },

    async getAccountBalance(
      session: AuthSession,
      input: {
        employeeId: string;
        account: LeaveLedgerAccount;
        year?: number;
        currentRequest?: LeaveRequest | null;
      },
    ): Promise<AccountBalanceSnapshot> {
      requireSession(session);
      await assertCanViewBalance(session, input.employeeId);
      await this.ensureBackfill(input.year ?? DEFAULT_YEAR);

      const year = input.year ?? DEFAULT_YEAR;
      const [entries, requests] = await Promise.all([
        deps.hr.listLeaveLedgerEntries({
          employeeId: input.employeeId,
          account: input.account,
          year,
        }),
        deps.hr.listLeaveRequests({ employeeId: input.employeeId }),
      ]);

      return computeAccountBalance({
        employeeId: input.employeeId,
        account: input.account,
        year,
        entries,
        leaveRequests: requests,
        currentRequest: input.currentRequest ?? null,
      });
    },

    async getEmployeeBalances(
      session: AuthSession,
      employeeId: string,
      year = DEFAULT_YEAR,
    ): Promise<Record<LeaveLedgerAccount, AccountBalanceSnapshot>> {
      requireSession(session);
      await assertCanViewBalance(session, employeeId);
      await this.ensureBackfill(year);

      const [entries, requests] = await Promise.all([
        deps.hr.listLeaveLedgerEntries({ employeeId, year }),
        deps.hr.listLeaveRequests({ employeeId }),
      ]);

      const result = {} as Record<LeaveLedgerAccount, AccountBalanceSnapshot>;
      for (const account of TRACKED_LEDGER_ACCOUNTS) {
        result[account] = computeAccountBalance({
          employeeId,
          account,
          year,
          entries,
          leaveRequests: requests,
          currentRequest: null,
        });
      }
      return result;
    },

    /**
     * Projection LeaveBalance (cache) depuis le grand livre — pour UI héritée.
     */
    async materializeLeaveBalanceProjection(
      employeeId: string,
      year = DEFAULT_YEAR,
    ): Promise<LeaveBalance> {
      await this.ensureBackfill(year);
      const [entries, requests] = await Promise.all([
        deps.hr.listLeaveLedgerEntries({ employeeId, year }),
        deps.hr.listLeaveRequests({ employeeId }),
      ]);
      const snapshots = TRACKED_LEDGER_ACCOUNTS.map((account) =>
        computeAccountBalance({
          employeeId,
          account,
          year,
          entries,
          leaveRequests: requests,
        }),
      );
      const patch = snapshotToLeaveBalanceFields(snapshots);
      return deps.hr.updateLeaveBalance(employeeId, year, patch);
    },

    async getBalanceForLeaveType(
      session: AuthSession,
      employeeId: string,
      leaveType: LeaveType,
      year = DEFAULT_YEAR,
      currentRequest?: LeaveRequest | null,
    ): Promise<AccountBalanceSnapshot | null> {
      const account = leaveTypeToLedgerAccount(leaveType);
      if (!account) return null;
      return this.getAccountBalance(session, {
        employeeId,
        account,
        year,
        currentRequest,
      });
    },

    /**
     * Consommation à l'approbation — idempotente par leave_request id.
     * Phase 1 : migration volontaire du cycle (auparavant aucun débit).
     */
    async recordApprovedLeaveConsumption(input: {
      request: LeaveRequest;
      actorEmployeeId: string;
    }): Promise<LeaveLedgerEntry | null> {
      const account = leaveTypeToLedgerAccount(input.request.type);
      if (!account) return null;

      const year = Number(input.request.startDate.slice(0, 4)) || DEFAULT_YEAR;
      const qty = -Math.abs(input.request.daysCount);
      const transactionType =
        account === "recuperation"
          ? ("recovery_consumption" as const)
          : ("leave_consumption" as const);

      const { entry, created } = await deps.hr.appendLeaveLedgerEntry({
        employeeId: input.request.employeeId,
        account,
        transactionType,
        quantity: qty,
        unit: "days",
        year,
        effectiveDate: input.request.startDate,
        sourceKind: "leave_request",
        sourceId: input.request.id,
        reason: `Consommation suite approbation de la demande ${input.request.id}.`,
        actorEmployeeId: input.actorEmployeeId,
        metadataJson: {
          leaveType: input.request.type,
          daysCount: input.request.daysCount,
          endDate: input.request.endDate,
        },
      });

      if (created) {
        await this.materializeLeaveBalanceProjection(
          input.request.employeeId,
          year,
        );
      }
      return entry;
    },

    async recordRecoveryCredit(input: {
      employeeId: string;
      year: number;
      daysCredited: number;
      hoursConfirmed: number;
      sourceRequestId: string;
      actorEmployeeId: string;
      effectiveDate: string;
    }): Promise<LeaveLedgerEntry> {
      assertPositiveQuantity(input.daysCredited);
      const { entry, created } = await deps.hr.appendLeaveLedgerEntry({
        employeeId: input.employeeId,
        account: "recuperation",
        transactionType: "recovery_credit",
        quantity: input.daysCredited,
        unit: "days",
        year: input.year,
        effectiveDate: input.effectiveDate,
        sourceKind: "work_on_holiday",
        sourceId: input.sourceRequestId,
        reason: `Crédit récupération (${input.hoursConfirmed} h confirmées).`,
        actorEmployeeId: input.actorEmployeeId,
        metadataJson: {
          hoursConfirmed: input.hoursConfirmed,
          daysCredited: input.daysCredited,
        },
      });
      if (created) {
        await this.materializeLeaveBalanceProjection(
          input.employeeId,
          input.year,
        );
      }
      return entry;
    },

    async adjustBalance(
      session: AuthSession,
      input: {
        employeeId: string;
        account: LeaveLedgerAccount;
        /** Signée : crédit > 0, débit < 0. */
        quantity: number;
        year?: number;
        effectiveDate: string;
        reason: string;
      },
    ): Promise<LeaveLedgerEntry> {
      requireSession(session);
      if (
        !canAccessHrAdministration(session.role) &&
        !hasPermission(session.role, "hr.administration")
      ) {
        throw new AuthError(
          "Ajustement de solde réservé aux Ressources humaines et au Chef de projet.",
          403,
        );
      }
      if (session.role === "collaborateur") {
        throw new AuthError("Les collaborateurs ne peuvent pas ajuster les soldes.", 403);
      }
      const reason = input.reason.trim();
      if (reason.length < 5) {
        throw new Error("Un motif d'ajustement d'au moins 5 caractères est requis.");
      }
      if (!Number.isFinite(input.quantity) || input.quantity === 0) {
        throw new Error("La quantité d'ajustement ne peut pas être nulle.");
      }

      const year = input.year ?? DEFAULT_YEAR;
      const sourceId = `adj:${session.employee.id}:${Date.now()}:${formatScaled(toScaled(input.quantity))}`;
      const { entry } = await deps.hr.appendLeaveLedgerEntry({
        employeeId: input.employeeId,
        account: input.account,
        transactionType: "hr_adjustment",
        quantity: input.quantity,
        unit: "days",
        year,
        effectiveDate: input.effectiveDate || moroccoToday(),
        sourceKind: "hr_adjustment",
        sourceId,
        reason,
        actorEmployeeId: session.employee.id,
      });
      await this.materializeLeaveBalanceProjection(input.employeeId, year);
      return entry;
    },

    async reverseEntry(
      session: AuthSession,
      entryId: string,
      reason: string,
    ): Promise<LeaveLedgerEntry> {
      requireSession(session);
      if (!canAccessHrAdministration(session.role)) {
        throw new AuthError("Contrepassation réservée aux rôles RH / Chef.", 403);
      }
      const entries = await deps.hr.listLeaveLedgerEntries({});
      const original = entries.find((e) => e.id === entryId);
      if (!original) throw new AuthError("Écriture introuvable.", 404);

      const { entry, created } = await deps.hr.appendLeaveLedgerEntry({
        employeeId: original.employeeId,
        account: original.account,
        transactionType: "reversal",
        quantity: -Number(original.quantity),
        unit: original.unit,
        year: original.year,
        effectiveDate: moroccoToday(),
        sourceKind: "leave_ledger_reversal",
        sourceId: original.id,
        reason: reason.trim() || `Contrepassation de ${original.id}`,
        actorEmployeeId: session.employee.id,
        reversesEntryId: original.id,
      });
      if (created) {
        await this.materializeLeaveBalanceProjection(
          original.employeeId,
          original.year,
        );
      }
      return entry;
    },
  };
}

async function assertCanViewBalance(
  session: AuthSession,
  employeeId: string,
): Promise<void> {
  if (session.employee.id === employeeId) return;
  if (
    hasPermission(session.role, "request.leave.view_all") ||
    canAccessHrAdministration(session.role)
  ) {
    return;
  }
  throw new AuthError(
    "Consultation du solde d'un autre collaborateur refusée.",
    403,
  );
}

export type LeaveLedgerService = ReturnType<typeof createLeaveLedgerService>;
