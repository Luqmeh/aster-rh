"use server";

import { revalidatePath } from "next/cache";
import { createWorkOnHolidayService } from "@/application/services/work-on-holiday-service";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

type ActionResult = { ok: true } | { ok: false; message: string };

function revalidate() {
  revalidatePath("/calendrier");
  revalidatePath("/conges");
  revalidatePath("/administration");
  revalidatePath("/notifications");
  revalidatePath("/tableau-de-bord");
}

function toError(error: unknown, fallback: string): ActionResult {
  if (error instanceof AuthError) return { ok: false, message: error.message };
  if (error instanceof Error && error.message.trim()) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: fallback };
}

export async function submitWorkOnHolidayAction(input: {
  holidayDate: string;
  plannedHours: number;
  plannedStart?: string;
  plannedEnd?: string;
  reason: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createWorkOnHolidayService(container);
    const created = await service.submit(session, input);
    revalidate();
    return { ok: true, id: created.id };
  } catch (error) {
    return toError(error, "Soumission impossible.");
  }
}

export async function decideWorkOnHolidayAction(
  id: string,
  decision: "approuvee" | "refusee",
  comment?: string,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createWorkOnHolidayService(container);
    await service.decide(session, id, decision, comment);
    revalidate();
    return { ok: true };
  } catch (error) {
    return toError(error, "Décision impossible.");
  }
}

export async function declareWorkOnHolidayActualAction(
  id: string,
  actualHours: number,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createWorkOnHolidayService(container);
    await service.declareActualHours(session, id, actualHours);
    revalidate();
    return { ok: true };
  } catch (error) {
    return toError(error, "Déclaration impossible.");
  }
}

export async function confirmWorkOnHolidayCreditAction(
  id: string,
  confirmedHours: number,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createWorkOnHolidayService(container);
    await service.confirmAndCredit(session, id, confirmedHours);
    revalidate();
    return { ok: true };
  } catch (error) {
    return toError(error, "Confirmation impossible.");
  }
}

export async function upsertHolidayOverrideAction(input: {
  sourceKey: string;
  date: string;
  nameFr: string;
  kind: "national" | "religious" | "company";
  confirmation: "confirmed" | "provisional";
  isActive: boolean;
  year: number;
}): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createWorkOnHolidayService(container);
    await service.upsertHolidayOverride(session, input);
    revalidate();
    return { ok: true };
  } catch (error) {
    return toError(error, "Enregistrement du jour férié impossible.");
  }
}
