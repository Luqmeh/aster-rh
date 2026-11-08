"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";
import { resetAsterDemoData } from "@/infrastructure/persistence/demo-data-lifecycle";
import { isDemoModeEnabled } from "@/infrastructure/persistence/persistence-mode";

/** Reset données démo — réservé admin RH + ASTER_MODE=demo. */
export async function resetDemoDataAction() {
  if (!isDemoModeEnabled()) {
    throw new Error(
      "Réinitialisation refusée hors mode démonstration ASTER.",
    );
  }

  const { auth, persistence } = getContainer();
  const session = requireSession(await auth.getSession());
  requireRole(session, "admin_rh");

  await resetAsterDemoData(persistence);
  revalidatePath("/", "layout");
  redirect("/parametres?reset=ok");
}
