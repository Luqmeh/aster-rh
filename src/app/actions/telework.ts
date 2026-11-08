"use server";

import { revalidatePath } from "next/cache";
import { createTeleworkService } from "@/application/services/telework-service";
import type { MonthlyTeleworkPlanInput } from "@/domain/rules/telework-monthly";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

function revalidateTeleworkPaths() {
  revalidatePath("/teletravail");
  revalidatePath("/tableau-de-bord");
  revalidatePath("/administration");
  revalidatePath("/notifications");
}

export async function submitMonthlyTeleworkPlanAction(
  input: MonthlyTeleworkPlanInput,
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createTeleworkService(container);
  const request = await service.submitMonthlyPlan(session, input);
  revalidateTeleworkPaths();
  return { ok: true as const, id: request.id };
}

export async function updateMonthlyTeleworkPlanAction(
  requestId: string,
  input: MonthlyTeleworkPlanInput,
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createTeleworkService(container);
  const request = await service.updatePendingPlan(session, requestId, input);
  revalidateTeleworkPaths();
  return { ok: true as const, id: request.id };
}

export async function withdrawMonthlyTeleworkPlanAction(requestId: string) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createTeleworkService(container);
  await service.withdrawPendingPlan(session, requestId);
  revalidateTeleworkPaths();
  return { ok: true as const };
}

export async function decideTeleworkAction(
  requestId: string,
  decision: "approuvee" | "refusee",
  comment?: string,
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  if (session.role === "collaborateur") {
    throw new AuthError(
      "Action réservée au manager ou à l'administrateur RH.",
      403,
    );
  }
  const service = createTeleworkService(container);
  const updated = await service.decide(session, requestId, decision, comment);
  revalidateTeleworkPaths();
  return {
    ok: true as const,
    id: updated.id,
    status: updated.status,
    decision,
  };
}
