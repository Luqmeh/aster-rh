import { z } from "zod";
import type { Employee, LeaveBalance, LeaveType } from "@/domain/types/hr";

/**
 * Règles de congés — ASTER département Maroc.
 *
 * Les ouvertures démo ne sont pas des droits statutaires validés.
 * L’acquisition passe par le moteur d’entitlement (politiques MA).
 * Voir docs/MOROCCO_HR_POLICY.md — ne pas réintroduire le guide FR comme défaut.
 */

export const leaveRequestInputSchema = z
  .object({
    type: z.enum([
      "conges_payes",
      "rtt",
      "recuperation",
      "sans_solde",
      "maladie",
      "exceptionnel",
      "parental",
    ]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    halfDayStart: z.boolean().default(false),
    halfDayEnd: z.boolean().default(false),
    comment: z.string().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "La date de fin doit être postérieure ou égale à la date de début.",
        path: ["endDate"],
      });
    }
  });

export type LeaveRequestInput = z.infer<typeof leaveRequestInputSchema>;

/** Démo : CP, RTT et récupération férié consomment le solde ; maladie / exceptionnel / parental / sans solde non. */
const BALANCE_CONSUMING: LeaveType[] = ["conges_payes", "rtt", "recuperation"];

export function usesLeaveBalance(type: LeaveType): boolean {
  return BALANCE_CONSUMING.includes(type);
}

/**
 * Ouvertures démo / seed uniquement — indépendant de cadre/non-cadre.
 * CP = 24 j (pratique entreprise 2 j/mois × 12) — À valider RH ; RTT = 0 (pas d’acquisition MA auto).
 */
export function defaultAnnualEntitlement(_category?: string): {
  congesPayes: number;
  rtt: number;
} {
  void _category;
  return { congesPayes: 24, rtt: 0 };
}

export function remainingBalanceForType(
  balance: LeaveBalance,
  type: LeaveType,
): number | null {
  if (type === "conges_payes") return balance.congesPayesRestants;
  if (type === "rtt") return balance.rttRestants;
  if (type === "recuperation") return balance.recoveryDaysRestants;
  return null;
}

export function assertSufficientBalance(
  balance: LeaveBalance,
  type: LeaveType,
  daysCount: number,
): { ok: true } | { ok: false; message: string } {
  if (!usesLeaveBalance(type)) return { ok: true };
  const remaining = remainingBalanceForType(balance, type);
  if (remaining === null) return { ok: true };
  if (daysCount > remaining) {
    return {
      ok: false,
      message: `Solde insuffisant : ${remaining} jour(s) disponible(s), ${daysCount} demandé(s).`,
    };
  }
  return { ok: true };
}

/**
 * Jours ouvrés lun–ven, hors week-end et hors jours exclus (fériés Maroc / corrections entreprise).
 * Demi-journées début/fin. Week-end site (ven–sam) : À valider RH.
 */
export function countBusinessDays(
  startDate: string,
  endDate: string,
  halfDayStart: boolean,
  halfDayEnd: boolean,
  excludedDates: string[] = [],
): number {
  const excluded = new Set(excludedDates);
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (end < start) return 0;

  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    if (dow !== 0 && dow !== 6 && !excluded.has(iso)) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (days === 0) return 0;
  if (startDate === endDate && (halfDayStart || halfDayEnd)) return 0.5;
  let adjustment = 0;
  if (halfDayStart) adjustment += 0.5;
  if (halfDayEnd && startDate !== endDate) adjustment += 0.5;
  return Math.max(0.5, days - adjustment);
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function canSubmitLeave(employee: Employee): boolean {
  return employee.isActive;
}

export function leaveTypeLabel(type: LeaveType): string {
  const labels: Record<LeaveType, string> = {
    conges_payes: "Congés payés",
    rtt: "RTT",
    recuperation: "Récupération (jour férié travaillé)",
    sans_solde: "Congé sans solde",
    maladie: "Absence maladie",
    exceptionnel: "Congé exceptionnel",
    parental: "Congé parental",
  };
  return labels[type];
}
