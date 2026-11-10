"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

export async function markNotificationsReadAction(ids?: string[]) {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const count = await container.hr.markNotificationsRead(
      session.employee.id,
      ids,
    );
    revalidatePath("/notifications");
    revalidatePath("/tableau-de-bord");
    return { ok: true as const, count };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Marquage impossible." };
  }
}
