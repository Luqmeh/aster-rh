"use server";

import { revalidatePath } from "next/cache";
import { createLeaveService } from "@/application/services/leave-service";
import type { LeaveRequestInput } from "@/domain/rules/leave";
import { getContainer } from "@/infrastructure/container";

export async function submitLeaveAction(input: LeaveRequestInput) {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session de démonstration absente.");
  const service = createLeaveService(container);
  const request = await service.submit(session, input);
  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  revalidatePath("/notifications");
  return { ok: true as const, id: request.id };
}

export async function decideLeaveAction(
  requestId: string,
  decision: "approuvee" | "refusee",
  comment?: string,
) {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session de démonstration absente.");
  if (session.role === "collaborateur") {
    throw new Error("Action réservée au manager ou à l'administrateur RH.");
  }
  const service = createLeaveService(container);
  const updated = await service.decide(session, requestId, decision, comment);
  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  revalidatePath("/administration");
  revalidatePath("/notifications");
  return {
    ok: true as const,
    id: updated.id,
    status: updated.status,
    decision,
  };
}
