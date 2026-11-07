import { z } from "zod";
import type { TeleworkType } from "@/domain/types/hr";
import {
  MAX_TELEWORK_DAYS_PER_WEEK,
  isTeleworkEligible,
} from "@/domain/rules/telework-monthly";
import type { Employee } from "@/domain/types/hr";

/**
 * Règles de télétravail — guide RH PKF Arsilon p.106 + planification mensuelle.
 * @see docs/HR_REQUIREMENTS.md § Télétravail
 */

/** @deprecated Prefer monthlyTeleworkPlanInputSchema — conservé pour compat tests ponctuels. */
export const teleworkRequestInputSchema = z
  .object({
    type: z.enum(["regulier", "occasionnel", "exceptionnel"]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
    reason: z.string().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "La date de fin doit être postérieure ou égale à la date de début.",
        path: ["endDate"],
      });
    }
    for (const day of value.days) {
      if (day < value.startDate || day > value.endDate) {
        ctx.addIssue({
          code: "custom",
          message: "Chaque jour demandé doit être compris dans la période.",
          path: ["days"],
        });
        break;
      }
    }
  });

export type TeleworkRequestInput = z.infer<typeof teleworkRequestInputSchema>;

export function maxTeleworkDaysPerWeek(employee?: Employee): number {
  void employee;
  return MAX_TELEWORK_DAYS_PER_WEEK;
}

export function assertWithinWeeklyCap(
  employee: Employee,
  daysInSameWeek: number,
): { ok: true } | { ok: false; message: string } {
  void employee;
  if (daysInSameWeek > MAX_TELEWORK_DAYS_PER_WEEK) {
    return {
      ok: false,
      message: `Le plafond de télétravail est de ${MAX_TELEWORK_DAYS_PER_WEEK} jour(s) par semaine.`,
    };
  }
  return { ok: true };
}

export { isTeleworkEligible };

export function teleworkTypeLabel(type: TeleworkType): string {
  const labels: Record<TeleworkType, string> = {
    regulier: "Plan mensuel",
    occasionnel: "Télétravail occasionnel",
    exceptionnel: "Télétravail exceptionnel",
  };
  return labels[type];
}
