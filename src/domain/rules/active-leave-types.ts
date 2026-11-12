import type { LeaveType } from "@/domain/types/hr";

/**
 * Types de congé proposés à la demande collaborateur.
 *
 * Décision Phase 5 — Récupération (férié travaillé) est le solde calculé
 * canonique (RecoveryCreditLedger + recoveryDays*). RTT n'est plus proposé
 * à la création de demande (historique ledger / LeaveType.rtt conservés).
 *
 * UI : les compteurs « RTT restants » (tableau de bord, /conges) sont retirés
 * pour ne pas concurrencer Récupération ; `rttRestants` reste exposé par les
 * services (ledger / exports soldes) pour l'historique.
 */
export const ACTIVE_LEAVE_REQUEST_TYPES: {
  value: LeaveType;
  label: string;
}[] = [
  { value: "conges_payes", label: "Congés payés" },
  {
    value: "recuperation",
    label: "Récupération (jour férié travaillé)",
  },
  { value: "sans_solde", label: "Congé sans solde" },
  { value: "exceptionnel", label: "Congé exceptionnel" },
  { value: "parental", label: "Congé parental" },
];

export const DEPRECATED_LEAVE_REQUEST_TYPES: LeaveType[] = ["rtt", "maladie"];

export function isActiveLeaveRequestType(type: LeaveType): boolean {
  return ACTIVE_LEAVE_REQUEST_TYPES.some((t) => t.value === type);
}
