export type LeaveLedgerAccount =
  | "conges_payes"
  | "conges_payes_acquis"
  | "conges_payes_en_acquisition"
  | "rtt"
  | "recuperation";

export type LeaveLedgerUnit = "days" | "hours";

export type LeaveLedgerTransactionType =
  | "opening_balance"
  | "accrual"
  | "leave_consumption"
  | "recovery_credit"
  | "recovery_consumption"
  | "carryover"
  | "expiry"
  | "hr_adjustment"
  | "reversal";

export type LeaveLedgerEntry = {
  id: string;
  employeeId: string;
  account: LeaveLedgerAccount;
  transactionType: LeaveLedgerTransactionType;
  /** Quantité signée (string décimale stabilisée). */
  quantity: string;
  unit: LeaveLedgerUnit;
  year: number;
  effectiveDate: string;
  createdAt: string;
  sourceKind: string;
  sourceId: string;
  reason: string;
  actorEmployeeId: string | null;
  reversesEntryId: string | null;
  metadataJson: Record<string, unknown> | null;
};

export type LeaveLedgerEntryCreateInput = {
  id?: string;
  employeeId: string;
  account: LeaveLedgerAccount;
  transactionType: LeaveLedgerTransactionType;
  quantity: string | number;
  unit?: LeaveLedgerUnit;
  year: number;
  effectiveDate: string;
  sourceKind: string;
  sourceId: string;
  reason: string;
  actorEmployeeId?: string | null;
  reversesEntryId?: string | null;
  metadataJson?: Record<string, unknown> | null;
};

/**
 * Vue autoritative d'un compte pour une année.
 * Définitions stables — utilisées par UI, reporting et file d'approbation.
 */
export type AccountBalanceSnapshot = {
  employeeId: string;
  account: LeaveLedgerAccount;
  year: number;
  unit: LeaveLedgerUnit;
  /** Σ crédits (quantités > 0 hors reversal déjà netté dans le grand livre). */
  totalCredited: number;
  /** Σ |débits de consommation| (leave_consumption, recovery_consumption). */
  totalConsumed: number;
  /** Σ |expiry|. */
  totalExpired: number;
  /** Σ hr_adjustment (signée). */
  totalAdjustments: number;
  /** Σ de toutes les écritures du compte/année. */
  ledgerBalance: number;
  /**
   * Autres demandes pending (même compte), hors demande courante.
   * N'est PAS une écriture ledger — réservation logique.
   */
  otherPendingReservations: number;
  /** ledgerBalance − otherPendingReservations */
  availableAfterReservations: number;
  /** Durée de la demande courante (0 si aucune). */
  currentRequestDays: number;
  /** availableAfterReservations − currentRequestDays */
  projectedAfterCurrentRequest: number;
  insufficientForCurrentRequest: boolean;
};
