import { canModifyTeleworkPlan } from "@/domain/rules/telework-monthly";
import type { RequestStatus, TeleworkRequest } from "@/domain/types/hr";

export type PlannerPrefill = {
  editingPlanId: string;
  initialMonth: string;
  initialDays: string[];
  initialReason: string;
};

/** Un plan ne peut être modifié que s'il est encore en attente. */
export function assertPlanEditable(
  plan: TeleworkRequest | null | undefined,
  employeeId: string,
): { ok: true; plan: TeleworkRequest } | { ok: false; message: string } {
  if (!plan) {
    return { ok: false, message: "Plan introuvable." };
  }
  if (plan.employeeId !== employeeId) {
    return { ok: false, message: "Vous ne pouvez modifier que vos propres plans." };
  }
  if (!canModifyTeleworkPlan(plan.status)) {
    return {
      ok: false,
      message:
        plan.status === "approuvee" || plan.status === "refusee"
          ? "Les plans approuvés ou refusés ne peuvent plus être modifiés."
          : "Seuls les plans en attente peuvent être modifiés.",
    };
  }
  return { ok: true, plan };
}

export function buildPlannerPrefill(plan: TeleworkRequest): PlannerPrefill {
  return {
    editingPlanId: plan.id,
    initialMonth: plan.month ?? plan.days[0]?.slice(0, 7) ?? "",
    initialDays: [...plan.days].sort(),
    initialReason: plan.reason ?? "",
  };
}

export function planStatusCaption(status: RequestStatus): string {
  switch (status) {
    case "en_attente_manager":
      return "En attente de validation manager — modifiable.";
    case "approuvee":
      return "Approuvé — visible au calendrier comme confirmé.";
    case "refusee":
      return "Refusé — visible au calendrier comme non confirmé.";
    case "annulee":
      return "Retiré.";
    default:
      return status;
  }
}

export function updatePlanSuccessMessage(requestId: string): string {
  return `Plan mis à jour (${requestId}).`;
}

export function createPlanSuccessMessage(requestId: string): string {
  return `Demande enregistrée (${requestId}).`;
}
