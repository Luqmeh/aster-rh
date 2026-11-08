"use server";

import { revalidatePath } from "next/cache";
import { createLeaveService } from "@/application/services/leave-service";
import type { LeaveRequestInput } from "@/domain/rules/leave";
import { canApproveRequests } from "@/domain/rules/permissions";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

export async function submitLeaveAction(input: LeaveRequestInput) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
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
  const session = requireSession(await container.auth.getSession());
  if (!canApproveRequests(session.role)) {
    throw new AuthError(
      session.role === "admin_rh"
        ? "Les ressources humaines peuvent consulter les demandes mais ne peuvent pas les approuver ni les refuser."
        : "Action réservée au Chef de projet.",
      403,
    );
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
