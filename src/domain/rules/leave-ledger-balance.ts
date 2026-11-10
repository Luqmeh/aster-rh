import {
  addScaled,
  fromScaled,
  isZeroScaled,
  negScaled,
  toScaled,
  zeroScaled,
  type ScaledQty,
} from "@/domain/rules/leave-decimal";
import {
  isLeavePendingStatus,
  requestOverlapsYear,
  sumLeaveDays,
} from "@/domain/rules/leave-approval-context";
import { usesLeaveBalance } from "@/domain/rules/leave";
import type {
  AccountBalanceSnapshot,
  LeaveLedgerAccount,
  LeaveLedgerEntry,
  LeaveLedgerTransactionType,
} from "@/domain/types/leave-ledger";
import type { LeaveRequest, LeaveType } from "@/domain/types/hr";

export const TRACKED_LEDGER_ACCOUNTS: LeaveLedgerAccount[] = [
  "conges_payes",
  "conges_payes_acquis",
  "conges_payes_en_acquisition",
  "rtt",
  "recuperation",
];

/** Comptes CP agrégés pour contrôle de solde / UI (Phase 1 legacy + Phase 2 split). */
export const CP_POOL_ACCOUNTS: LeaveLedgerAccount[] = [
  "conges_payes",
  "conges_payes_acquis",
  "conges_payes_en_acquisition",
];

export function isCpLedgerAccount(account: LeaveLedgerAccount): boolean {
  return CP_POOL_ACCOUNTS.includes(account);
}

export function leaveTypeToLedgerAccount(
  type: LeaveType,
): LeaveLedgerAccount | null {
  if (!usesLeaveBalance(type)) return null;
  if (type === "conges_payes" || type === "rtt" || type === "recuperation") {
    return type;
  }
  return null;
}

/**
 * Ordre de débit CP à l'approbation : acquis → legacy → en acquisition.
 * (Les employés peuvent consommer acquis et en cours — guide p.38–48.)
 */
export const CP_CONSUMPTION_ORDER: LeaveLedgerAccount[] = [
  "conges_payes_acquis",
  "conges_payes",
  "conges_payes_en_acquisition",
];

export function isCreditType(type: LeaveLedgerTransactionType): boolean {
  return (
    type === "opening_balance" ||
    type === "accrual" ||
    type === "recovery_credit" ||
    type === "carryover" ||
    type === "hr_adjustment" ||
    type === "reversal"
  );
}

export function isConsumptionType(type: LeaveLedgerTransactionType): boolean {
  return type === "leave_consumption" || type === "recovery_consumption";
}

/**
 * Agrège les écritures d'un compte (unité days) avec réservations pending.
 */
export function computeAccountBalance(input: {
  employeeId: string;
  account: LeaveLedgerAccount;
  year: number;
  entries: LeaveLedgerEntry[];
  leaveRequests: LeaveRequest[];
  /** Demande en cours d'examen (exclue des « autres » réservations). */
  currentRequest?: LeaveRequest | null;
}): AccountBalanceSnapshot {
  const {
    employeeId,
    account,
    year,
    entries,
    leaveRequests,
    currentRequest = null,
  } = input;

  let credited: ScaledQty = zeroScaled();
  let consumed: ScaledQty = zeroScaled();
  let expired: ScaledQty = zeroScaled();
  let adjustments: ScaledQty = zeroScaled();
  let ledger: ScaledQty = zeroScaled();
  const zero = zeroScaled();

  for (const entry of entries) {
    if (entry.employeeId !== employeeId) continue;
    if (entry.account !== account) continue;
    if (entry.year !== year) continue;
    if (entry.unit !== "days") continue;

    const qty = toScaled(entry.quantity);
    ledger = addScaled(ledger, qty);

    if (entry.transactionType === "expiry") {
      expired = addScaled(expired, qty < zero ? negScaled(qty) : qty);
      continue;
    }
    if (entry.transactionType === "hr_adjustment") {
      adjustments = addScaled(adjustments, qty);
    }
    if (isConsumptionType(entry.transactionType)) {
      consumed = addScaled(consumed, qty < zero ? negScaled(qty) : qty);
    } else if (qty > zero) {
      // opening_balance positif, accrual, recovery_credit, carryover, reversal crédit…
      credited = addScaled(credited, qty);
    } else if (
      entry.transactionType === "opening_balance" &&
      qty < zero
    ) {
      // Ouverture « pris » (snapshot migration) compte comme consommation historique.
      consumed = addScaled(consumed, negScaled(qty));
    }
  }

  const matchesLeaveAccount = (leaveType: LeaveType): boolean => {
    const mapped = leaveTypeToLedgerAccount(leaveType);
    if (!mapped) return false;
    if (mapped === account) return true;
    // Réservations CP portent sur le pool (tous comptes CP).
    if (mapped === "conges_payes" && isCpLedgerAccount(account)) return true;
    return false;
  };

  const otherPendingReservations = sumLeaveDays(leaveRequests, (r) => {
    if (r.employeeId !== employeeId) return false;
    if (!matchesLeaveAccount(r.type)) return false;
    // Éviter de compter N fois la même réservation CP sur chaque compte du pool :
    // on ne rattache les réservations CP qu'au compte legacy `conges_payes`.
    if (r.type === "conges_payes" && account !== "conges_payes") return false;
    if (!requestOverlapsYear(r, year)) return false;
    if (!isLeavePendingStatus(r.status)) return false;
    if (currentRequest && r.id === currentRequest.id) return false;
    return true;
  });

  const currentRequestDays =
    currentRequest &&
    currentRequest.employeeId === employeeId &&
    matchesLeaveAccount(currentRequest.type) &&
    (currentRequest.type !== "conges_payes" || account === "conges_payes")
      ? currentRequest.daysCount
      : 0;

  const otherPendingScaled = toScaled(otherPendingReservations);
  const currentScaled = toScaled(currentRequestDays);
  const availableAfter = addScaled(ledger, negScaled(otherPendingScaled));
  const projected = addScaled(availableAfter, negScaled(currentScaled));

  return {
    employeeId,
    account,
    year,
    unit: "days",
    totalCredited: fromScaled(credited),
    totalConsumed: fromScaled(consumed),
    totalExpired: fromScaled(expired),
    totalAdjustments: fromScaled(adjustments),
    ledgerBalance: fromScaled(ledger),
    otherPendingReservations,
    availableAfterReservations: fromScaled(availableAfter),
    currentRequestDays,
    projectedAfterCurrentRequest: fromScaled(projected),
    insufficientForCurrentRequest:
      currentRequestDays > 0 && compareLess(projected, zeroScaled()),
  };
}

function compareLess(a: ScaledQty, b: ScaledQty): boolean {
  return a < b;
}

/**
 * Solde CP autoritatif = somme des comptes du pool (legacy + acquis + en acquisition).
 * Les réservations pending CP sont portées une seule fois (sur `conges_payes`).
 */
export function computeCpPooledBalance(input: {
  employeeId: string;
  year: number;
  entries: LeaveLedgerEntry[];
  leaveRequests: LeaveRequest[];
  currentRequest?: LeaveRequest | null;
}): AccountBalanceSnapshot {
  const parts = CP_POOL_ACCOUNTS.map((account) =>
    computeAccountBalance({
      ...input,
      account,
      currentRequest: input.currentRequest ?? null,
    }),
  );
  const legacy = parts.find((p) => p.account === "conges_payes")!;
  const ledgerBalance = parts.reduce((s, p) => s + p.ledgerBalance, 0);
  const totalCredited = parts.reduce((s, p) => s + p.totalCredited, 0);
  const totalConsumed = parts.reduce((s, p) => s + p.totalConsumed, 0);
  const totalExpired = parts.reduce((s, p) => s + p.totalExpired, 0);
  const totalAdjustments = parts.reduce((s, p) => s + p.totalAdjustments, 0);
  const otherPending = legacy.otherPendingReservations;
  const currentDays = legacy.currentRequestDays;
  const available = ledgerBalance - otherPending;
  const projected = available - currentDays;
  return {
    employeeId: input.employeeId,
    account: "conges_payes",
    year: input.year,
    unit: "days",
    totalCredited,
    totalConsumed,
    totalExpired,
    totalAdjustments,
    ledgerBalance,
    otherPendingReservations: otherPending,
    availableAfterReservations: available,
    currentRequestDays: currentDays,
    projectedAfterCurrentRequest: projected,
    insufficientForCurrentRequest: currentDays > 0 && projected < 0,
  };
}

export function assertPositiveQuantity(quantity: number | string): void {
  const q = toScaled(quantity);
  if (q <= zeroScaled()) {
    throw new Error("La quantité doit être strictement positive.");
  }
}

export function openingSourceId(
  employeeId: string,
  year: number,
  account: LeaveLedgerAccount,
  leg: "acquis" | "pris",
): string {
  return `${employeeId}:${year}:${account}:${leg}`;
}

export const OPENING_SOURCE_KIND = "leave_balance_opening";

export function buildOpeningEntriesFromBalance(input: {
  employeeId: string;
  year: number;
  account: LeaveLedgerAccount;
  acquis: number;
  pris: number;
  restants: number;
  effectiveDate: string;
}): Array<{
  account: LeaveLedgerAccount;
  transactionType: "opening_balance";
  quantity: number;
  year: number;
  effectiveDate: string;
  sourceKind: string;
  sourceId: string;
  reason: string;
  metadataJson: Record<string, unknown>;
}> {
  const { employeeId, year, account, acquis, pris, restants, effectiveDate } =
    input;
  const entries: Array<{
    account: LeaveLedgerAccount;
    transactionType: "opening_balance";
    quantity: number;
    year: number;
    effectiveDate: string;
    sourceKind: string;
    sourceId: string;
    reason: string;
    metadataJson: Record<string, unknown>;
  }> = [];

  const net = toScaled(acquis) + negScaled(toScaled(pris));
  const expected = toScaled(restants);
  const metadataBase = {
    migratedFrom: "LeaveBalance",
    acquis,
    pris,
    restants,
    netMatchesRestants: isZeroScaled(net + negScaled(expected)),
  };

  if (!isZeroScaled(toScaled(acquis))) {
    entries.push({
      account,
      transactionType: "opening_balance",
      quantity: acquis,
      year,
      effectiveDate,
      sourceKind: OPENING_SOURCE_KIND,
      sourceId: openingSourceId(employeeId, year, account, "acquis"),
      reason:
        "Solde d'ouverture (acquis) — migration LeaveBalance, sans historique inventé.",
      metadataJson: { ...metadataBase, leg: "acquis" },
    });
  }
  if (!isZeroScaled(toScaled(pris))) {
    entries.push({
      account,
      transactionType: "opening_balance",
      quantity: -pris,
      year,
      effectiveDate,
      sourceKind: OPENING_SOURCE_KIND,
      sourceId: openingSourceId(employeeId, year, account, "pris"),
      reason:
        "Solde d'ouverture (pris) — migration LeaveBalance, sans historique inventé.",
      metadataJson: { ...metadataBase, leg: "pris" },
    });
  }
  // Si acquis=pris=0 mais restants≠0 (anomalie), figer le restant seul.
  if (
    isZeroScaled(toScaled(acquis)) &&
    isZeroScaled(toScaled(pris)) &&
    !isZeroScaled(toScaled(restants))
  ) {
    entries.push({
      account,
      transactionType: "opening_balance",
      quantity: restants,
      year,
      effectiveDate,
      sourceKind: OPENING_SOURCE_KIND,
      sourceId: openingSourceId(employeeId, year, account, "acquis"),
      reason:
        "Solde d'ouverture (restants seuls) — migration LeaveBalance.",
      metadataJson: { ...metadataBase, leg: "restants_only" },
    });
  }

  return entries;
}
