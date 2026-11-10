import {
  leaveTypeLabel,
  remainingBalanceForType,
  usesLeaveBalance,
} from "@/domain/rules/leave";
import type {
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  RequestStatus,
  WorkAbsence,
  WorkAbsenceCategory,
} from "@/domain/types/hr";
import type { AccountBalanceSnapshot } from "@/domain/types/leave-ledger";

/** Statuts qui réservent encore du solde (non terminaux, non refusés). */
export const LEAVE_PENDING_STATUSES: RequestStatus[] = [
  "soumise",
  "en_attente_manager",
  "en_attente_rh",
];

export function isLeavePendingStatus(status: RequestStatus): boolean {
  return LEAVE_PENDING_STATUSES.includes(status);
}

/** Congé effectivement pris / validé (jamais pending ni refusé). */
export function isLeaveTakenStatus(status: RequestStatus): boolean {
  return status === "approuvee";
}

export function requestOverlapsYear(
  request: Pick<LeaveRequest, "startDate" | "endDate">,
  year: number,
): boolean {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  return request.startDate <= yearEnd && request.endDate >= yearStart;
}

export function sumLeaveDays(
  requests: LeaveRequest[],
  predicate: (r: LeaveRequest) => boolean,
): number {
  return requests.reduce(
    (sum, request) => (predicate(request) ? sum + request.daysCount : sum),
    0,
  );
}

export type LeaveBalanceContext = {
  tracked: boolean;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  /** Total crédité (grand livre). */
  entitlement: number | null;
  /** Total consommé (grand livre). */
  consumedRecorded: number | null;
  /** Solde ledger (écritures réelles uniquement). */
  availableNow: number | null;
  /** Autres demandes pending même type (réservations, hors ledger). */
  otherPendingReservedDays: number;
  /** Disponible après autres réservations (= ledger − autres pending). */
  availableAfterReservations: number | null;
  /** Demandes approuvées même type sur l'année (lecture demandes). */
  approvedDaysFromRequests: number;
  /** Durée de la demande en revue. */
  requestDays: number;
  /**
   * Solde projeté si cette demande est approuvée :
   * availableAfterReservations − requestDays.
   */
  projectedAvailableAfterApproval: number | null;
  insufficientForRequest: boolean;
  untrackedLabel: string | null;
};

function balanceFieldsForType(
  balance: LeaveBalance,
  type: LeaveType,
): { entitlement: number; consumed: number; remaining: number } | null {
  if (type === "conges_payes") {
    return {
      entitlement: balance.congesPayesAcquis,
      consumed: balance.congesPayesPris,
      remaining: balance.congesPayesRestants,
    };
  }
  if (type === "rtt") {
    return {
      entitlement: balance.rttAcquis,
      consumed: balance.rttPris,
      remaining: balance.rttRestants,
    };
  }
  if (type === "recuperation") {
    return {
      entitlement: balance.recoveryDaysAcquis,
      consumed: balance.recoveryDaysPris,
      remaining: balance.recoveryDaysRestants,
    };
  }
  return null;
}

/** Construit le panneau depuis le snapshot autoritatif du grand livre. */
export function buildLeaveBalanceContextFromLedger(input: {
  snapshot: AccountBalanceSnapshot | null;
  leaveType: LeaveType;
  employeeRequests: LeaveRequest[];
  currentRequest: LeaveRequest;
  year: number;
}): LeaveBalanceContext {
  const { snapshot, leaveType, employeeRequests, currentRequest, year } = input;
  const label = leaveTypeLabel(leaveType);
  const requestDays = currentRequest.daysCount;
  const approvedDaysFromRequests = sumLeaveDays(
    employeeRequests,
    (r) =>
      r.employeeId === currentRequest.employeeId &&
      r.type === leaveType &&
      requestOverlapsYear(r, year) &&
      r.id !== currentRequest.id &&
      isLeaveTakenStatus(r.status),
  );

  if (!usesLeaveBalance(leaveType)) {
    return {
      tracked: false,
      leaveType,
      leaveTypeLabel: label,
      entitlement: null,
      consumedRecorded: null,
      availableNow: null,
      otherPendingReservedDays: 0,
      availableAfterReservations: null,
      approvedDaysFromRequests,
      requestDays,
      projectedAvailableAfterApproval: null,
      insufficientForRequest: false,
      untrackedLabel: "Solde non suivi",
    };
  }

  if (!snapshot) {
    return {
      tracked: true,
      leaveType,
      leaveTypeLabel: label,
      entitlement: null,
      consumedRecorded: null,
      availableNow: null,
      otherPendingReservedDays: 0,
      availableAfterReservations: null,
      approvedDaysFromRequests,
      requestDays,
      projectedAvailableAfterApproval: null,
      insufficientForRequest: false,
      untrackedLabel: "Solde non renseigné pour cette année",
    };
  }

  return {
    tracked: true,
    leaveType,
    leaveTypeLabel: label,
    entitlement: snapshot.totalCredited,
    consumedRecorded: snapshot.totalConsumed,
    availableNow: snapshot.ledgerBalance,
    otherPendingReservedDays: snapshot.otherPendingReservations,
    availableAfterReservations: snapshot.availableAfterReservations,
    approvedDaysFromRequests,
    requestDays: snapshot.currentRequestDays || requestDays,
    projectedAvailableAfterApproval: snapshot.projectedAfterCurrentRequest,
    insufficientForRequest: snapshot.insufficientForCurrentRequest,
    untrackedLabel: null,
  };
}

/**
 * Contexte solde (compatibilité tests / snapshot LeaveBalance).
 * Formules Phase 1 : disponible après réservations = ledger − autres pending.
 */
export function buildLeaveBalanceContext(input: {
  balance: LeaveBalance | null;
  leaveType: LeaveType;
  employeeRequests: LeaveRequest[];
  currentRequest: LeaveRequest;
  year: number;
}): LeaveBalanceContext {
  const { balance, leaveType, employeeRequests, currentRequest, year } = input;
  const label = leaveTypeLabel(leaveType);
  const requestDays = currentRequest.daysCount;

  const sameTypeYear = (r: LeaveRequest) =>
    r.employeeId === currentRequest.employeeId &&
    r.type === leaveType &&
    requestOverlapsYear(r, year);

  const otherPendingReservedDays = sumLeaveDays(
    employeeRequests,
    (r) =>
      sameTypeYear(r) &&
      r.id !== currentRequest.id &&
      isLeavePendingStatus(r.status),
  );

  const approvedDaysFromRequests = sumLeaveDays(
    employeeRequests,
    (r) =>
      sameTypeYear(r) &&
      r.id !== currentRequest.id &&
      isLeaveTakenStatus(r.status),
  );

  if (!usesLeaveBalance(leaveType)) {
    return {
      tracked: false,
      leaveType,
      leaveTypeLabel: label,
      entitlement: null,
      consumedRecorded: null,
      availableNow: null,
      otherPendingReservedDays,
      availableAfterReservations: null,
      approvedDaysFromRequests,
      requestDays,
      projectedAvailableAfterApproval: null,
      insufficientForRequest: false,
      untrackedLabel: "Solde non suivi",
    };
  }

  const fields = balance ? balanceFieldsForType(balance, leaveType) : null;
  if (!fields) {
    return {
      tracked: true,
      leaveType,
      leaveTypeLabel: label,
      entitlement: null,
      consumedRecorded: null,
      availableNow: null,
      otherPendingReservedDays,
      availableAfterReservations: null,
      approvedDaysFromRequests,
      requestDays,
      projectedAvailableAfterApproval: null,
      insufficientForRequest: false,
      untrackedLabel: "Solde non renseigné pour cette année",
    };
  }

  const ledgerBalance = fields.remaining;
  const availableAfter = ledgerBalance - otherPendingReservedDays;
  const projected = availableAfter - requestDays;

  return {
    tracked: true,
    leaveType,
    leaveTypeLabel: label,
    entitlement: fields.entitlement,
    consumedRecorded: fields.consumed,
    availableNow: ledgerBalance,
    otherPendingReservedDays,
    availableAfterReservations: availableAfter,
    approvedDaysFromRequests,
    requestDays,
    projectedAvailableAfterApproval: projected,
    insufficientForRequest: requestDays > availableAfter,
    untrackedLabel: null,
  };
}

export type LeaveHistoryEntry = {
  id: string;
  type: LeaveType;
  typeLabel: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: RequestStatus;
};

/** Dernier congé pris (approuvé) — priorité au même type, sinon tout type LeaveRequest. */
export function selectLastTakenLeave(
  requests: LeaveRequest[],
  preferredType: LeaveType | null,
  asOfDate: string,
): LeaveHistoryEntry | null {
  const taken = requests
    .filter(
      (r) =>
        isLeaveTakenStatus(r.status) &&
        r.endDate <= asOfDate &&
        // Une demande encore future approuvée n'est pas « déjà prise ».
        true,
    )
    .sort((a, b) => {
      if (a.endDate === b.endDate) return b.startDate.localeCompare(a.startDate);
      return b.endDate.localeCompare(a.endDate);
    });

  const preferred =
    preferredType == null
      ? null
      : taken.find((r) => r.type === preferredType) ?? null;
  const pick = preferred ?? taken[0] ?? null;
  if (!pick) return null;
  return {
    id: pick.id,
    type: pick.type,
    typeLabel: leaveTypeLabel(pick.type),
    startDate: pick.startDate,
    endDate: pick.endDate,
    daysCount: pick.daysCount,
    status: pick.status,
  };
}

export function buildLeaveHistoryEntries(
  requests: LeaveRequest[],
  options: {
    preferredType?: LeaveType | null;
    excludeIds?: string[];
    limit?: number;
    /** Si true, n'inclut que les congés pris (approuvés). */
    takenOnly?: boolean;
  } = {},
): LeaveHistoryEntry[] {
  const exclude = new Set(options.excludeIds ?? []);
  const limit = options.limit ?? 5;
  const takenOnly = options.takenOnly ?? true;

  const filtered = requests
    .filter((r) => !exclude.has(r.id))
    .filter((r) => (takenOnly ? isLeaveTakenStatus(r.status) : true))
    // Pending / refused never count as history of leave taken when takenOnly.
    .filter((r) => r.status !== "refusee" && r.status !== "annulee")
    .sort((a, b) => {
      const pref = options.preferredType;
      if (pref) {
        const aPref = a.type === pref ? 0 : 1;
        const bPref = b.type === pref ? 0 : 1;
        if (aPref !== bPref) return aPref - bPref;
      }
      return b.endDate.localeCompare(a.endDate);
    })
    .slice(0, limit);

  return filtered.map((r) => ({
    id: r.id,
    type: r.type,
    typeLabel: leaveTypeLabel(r.type),
    startDate: r.startDate,
    endDate: r.endDate,
    daysCount: r.daysCount,
    status: r.status,
  }));
}

export type WorkAbsenceHistoryEntry = {
  id: string;
  category: WorkAbsenceCategory;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: WorkAbsence["status"];
  family: WorkAbsence["family"];
};

/** Absences opérationnelles terminées / enregistrées — jamais refuse ni pending seul. */
export function isWorkAbsenceCompleted(
  status: WorkAbsence["status"],
): boolean {
  return status === "termine" || status === "enregistre";
}

export function selectLastCompletedWorkAbsence(
  absences: WorkAbsence[],
  preferredCategory: WorkAbsenceCategory | null,
  asOfDate: string,
): WorkAbsenceHistoryEntry | null {
  const completed = absences
    .filter(
      (a) =>
        isWorkAbsenceCompleted(a.status) && a.endDate <= asOfDate,
    )
    .sort((a, b) => b.endDate.localeCompare(a.endDate));

  const preferred =
    preferredCategory == null
      ? null
      : completed.find((a) => a.category === preferredCategory) ?? null;
  const pick = preferred ?? completed[0] ?? null;
  if (!pick) return null;
  return {
    id: pick.id,
    category: pick.category,
    startDate: pick.startDate,
    endDate: pick.endDate,
    daysCount: pick.daysCount,
    status: pick.status,
    family: pick.family,
  };
}

/**
 * Jours déjà comptés pour le barème spécial — aligné sur
 * work-absence-service.declare (startDate année + statut ≠ refuse).
 */
export function sumSpecialLeaveDaysUsedThisYear(
  absences: WorkAbsence[],
  category: WorkAbsenceCategory,
  year: number,
  excludeId?: string,
): number {
  const prefix = String(year);
  return absences.reduce((sum, a) => {
    if (excludeId && a.id === excludeId) return sum;
    if (a.category !== category) return sum;
    if (a.status === "refuse") return sum;
    if (!a.startDate.startsWith(prefix)) return sum;
    return sum + a.daysCount;
  }, 0);
}

/** Vérifie la cohérence remainingBalanceForType vs champs détaillés. */
export function remainingMatchesBalance(
  balance: LeaveBalance,
  type: LeaveType,
): boolean {
  const remaining = remainingBalanceForType(balance, type);
  const fields = balanceFieldsForType(balance, type);
  if (remaining === null || !fields) return true;
  return remaining === fields.remaining;
}
