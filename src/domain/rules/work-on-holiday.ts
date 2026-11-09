import type {
  Employee,
  WorkOnHolidayStatus,
} from "@/domain/types/hr";

export const OPEN_WORK_ON_HOLIDAY_STATUSES: ReadonlySet<WorkOnHolidayStatus> =
  new Set([
    "en_attente",
    "approuvee",
    "travail_effectue_a_confirmer",
  ]);

export function workOnHolidayStatusLabel(status: WorkOnHolidayStatus): string {
  const labels: Record<WorkOnHolidayStatus, string> = {
    en_attente: "En attente",
    approuvee: "Approuvée",
    refusee: "Refusée",
    travail_effectue_a_confirmer: "Travail effectué — à confirmer",
    confirmee_credit_appliquee: "Confirmée — récupération créditée",
  };
  return labels[status];
}

/**
 * Conversion heures → jours fractionnaires selon l'horaire journalier du collaborateur.
 * HYPOTHÈSE DÉMO produit ASTER — pas une règle guide PKF.
 */
export function hoursToRecoveryDays(
  hours: number,
  standardDailyHours: number,
): number {
  if (hours <= 0) return 0;
  const daily = standardDailyHours > 0 ? standardDailyHours : 7;
  return Math.round((hours / daily) * 1000) / 1000;
}

export function resolveStandardDailyHours(employee: Employee): number {
  return employee.standardDailyHours > 0 ? employee.standardDailyHours : 7;
}

export function canTransitionWorkOnHoliday(
  from: WorkOnHolidayStatus,
  to: WorkOnHolidayStatus,
): boolean {
  const allowed: Record<WorkOnHolidayStatus, WorkOnHolidayStatus[]> = {
    en_attente: ["approuvee", "refusee"],
    approuvee: ["travail_effectue_a_confirmer", "refusee"],
    refusee: [],
    travail_effectue_a_confirmer: ["confirmee_credit_appliquee", "approuvee"],
    confirmee_credit_appliquee: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

/** L'approbation doit précéder le jour férié travaillé. */
export function assertApprovalBeforeHoliday(
  holidayDate: string,
  nowIso = new Date().toISOString(),
): { ok: true } | { ok: false; message: string } {
  const today = nowIso.slice(0, 10);
  if (holidayDate < today) {
    return {
      ok: false,
      message:
        "Une demande de travail un jour férié doit être approuvée avant la date du jour férié.",
    };
  }
  return { ok: true };
}

export function assertCanDeclareActualWork(
  holidayDate: string,
  status: WorkOnHolidayStatus,
  nowIso = new Date().toISOString(),
): { ok: true } | { ok: false; message: string } {
  if (status !== "approuvee") {
    return {
      ok: false,
      message: "Seule une demande approuvée peut recevoir les heures réelles.",
    };
  }
  const today = nowIso.slice(0, 10);
  if (holidayDate > today) {
    return {
      ok: false,
      message:
        "Les heures réelles se déclarent après le jour férié travaillé.",
    };
  }
  return { ok: true };
}

/**
 * Les heures déclarées / confirmées font l'objet d'une revue explicite si
 * elles dépassent le planifié — pas de crédit automatique du planifié.
 */
export function assertActualHoursReview(
  plannedHours: number,
  actualHours: number,
): { ok: true; needsExplicitReview: boolean } | { ok: false; message: string } {
  if (actualHours <= 0 || actualHours > 24) {
    return {
      ok: false,
      message: "Indiquez une durée réelle comprise entre 0 et 24 heures.",
    };
  }
  return {
    ok: true,
    needsExplicitReview: actualHours > plannedHours,
  };
}
