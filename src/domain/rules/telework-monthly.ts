import { z } from "zod";
import {
  groupWeekdaysByIsoWeek,
  isDateOnly,
  isMonthKey,
  isWeekend,
  isoWeekKey,
  monthBounds,
  monthKeyFromDate,
} from "@/domain/rules/dates";
import type { Employee, LeaveRequest, RequestStatus } from "@/domain/types/hr";
import { expandDateRange } from "@/domain/rules/dates";

/**
 * Règles télétravail mensuel — Guide RH PKF Arsilon p.106 :
 * - jusqu'à 12 jours / mois
 * - minimum 80 % du temps de travail (cadre d'éligibilité, non calculé ici)
 * - tâches compatibles + continuité de service
 *
 * Planification UI : max 2 jours / semaine + plafond mensuel 12.
 */

export const MAX_TELEWORK_DAYS_PER_WEEK = 2;
export const MAX_TELEWORK_DAYS_PER_MONTH = 12;

export const monthlyTeleworkPlanInputSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  reason: z.string().max(1000).optional(),
});

export type MonthlyTeleworkPlanInput = z.infer<
  typeof monthlyTeleworkPlanInputSchema
>;

export function isTeleworkEligible(employee: Employee): boolean {
  return employee.isActive && employee.teleworkEligible;
}

export function assertTeleworkEligibility(
  employee: Employee,
): { ok: true } | { ok: false; message: string } {
  if (!employee.isActive) {
    return { ok: false, message: "Collaborateur inactif — planification impossible." };
  }
  if (!employee.teleworkEligible) {
    return {
      ok: false,
      message:
        "Ce profil de démonstration n'est pas éligible au télétravail (tâches incompatibles ou continuité de service — guide RH p.106).",
    };
  }
  return { ok: true };
}

export type MonthlyPlanValidationOk = {
  ok: true;
  month: string;
  days: string[];
  byWeek: Record<string, string[]>;
};

export type MonthlyPlanValidationErr = {
  ok: false;
  message: string;
};

export function validateMonthlyTeleworkPlan(
  month: string,
  days: string[],
  approvedLeave: LeaveRequest[] = [],
): MonthlyPlanValidationOk | MonthlyPlanValidationErr {
  if (!isMonthKey(month)) {
    return { ok: false, message: "Le mois sélectionné est invalide." };
  }
  if (days.length === 0) {
    return {
      ok: false,
      message: "Sélectionnez au moins un jour de télétravail.",
    };
  }

  const unique = [...new Set(days)].sort();
  if (unique.length !== days.length) {
    return { ok: false, message: "Des dates en double ont été détectées." };
  }

  const { start, end } = monthBounds(month);
  for (const day of unique) {
    if (!isDateOnly(day)) {
      return { ok: false, message: `Date invalide : ${day}.` };
    }
    if (day < start || day > end) {
      return {
        ok: false,
        message: "Tous les jours doivent appartenir au mois sélectionné.",
      };
    }
    if (isWeekend(day)) {
      return {
        ok: false,
        message: "Les week-ends ne peuvent pas être planifiés en télétravail.",
      };
    }
  }

  if (unique.length > MAX_TELEWORK_DAYS_PER_MONTH) {
    return {
      ok: false,
      message: `Le plafond est de ${MAX_TELEWORK_DAYS_PER_MONTH} jours de télétravail par mois (guide RH p.106).`,
    };
  }

  const byWeek: Record<string, string[]> = {};
  for (const day of unique) {
    const week = isoWeekKey(day);
    byWeek[week] = [...(byWeek[week] ?? []), day];
  }
  for (const [week, weekDays] of Object.entries(byWeek)) {
    if (weekDays.length > MAX_TELEWORK_DAYS_PER_WEEK) {
      return {
        ok: false,
        message: `Maximum ${MAX_TELEWORK_DAYS_PER_WEEK} jours de télétravail par semaine (semaine ${week}).`,
      };
    }
  }

  const leaveDays = new Set<string>();
  for (const leave of approvedLeave) {
    if (leave.status !== "approuvee") continue;
    for (const d of expandDateRange(leave.startDate, leave.endDate)) {
      leaveDays.add(d);
    }
  }
  const conflicts = unique.filter((d) => leaveDays.has(d));
  if (conflicts.length > 0) {
    return {
      ok: false,
      message: `Conflit avec un congé approuvé le(s) : ${conflicts.join(", ")}.`,
    };
  }

  return { ok: true, month, days: unique, byWeek };
}

export function canWithdrawTeleworkPlan(status: RequestStatus): boolean {
  return status === "en_attente_manager" || status === "brouillon";
}

export function canModifyTeleworkPlan(status: RequestStatus): boolean {
  return status === "en_attente_manager" || status === "brouillon";
}

export function planningWeeksForMonth(month: string) {
  return groupWeekdaysByIsoWeek(month);
}

export function monthOfPlan(days: string[], fallbackMonth?: string | null): string {
  if (fallbackMonth && isMonthKey(fallbackMonth)) return fallbackMonth;
  if (days[0]) return monthKeyFromDate(days[0]);
  throw new Error("Impossible de déterminer le mois du plan.");
}
