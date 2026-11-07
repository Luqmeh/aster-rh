"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/infrastructure/container";
import { resetAsterDemoData } from "@/infrastructure/persistence/demo-data-lifecycle";
import { isDemoModeEnabled } from "@/infrastructure/persistence/persistence-mode";

export async function switchDemoIdentityAction(identityId: string) {
  const { auth } = getContainer();
  await auth.switchDemoIdentity(identityId);
  revalidatePath("/", "layout");
}

export async function resetDemoDataAction() {
  if (!isDemoModeEnabled()) {
    throw new Error(
      "Réinitialisation refusée hors mode démonstration ASTER.",
    );
  }

  const { persistence } = getContainer();
  await resetAsterDemoData(persistence);
  revalidatePath("/", "layout");
  redirect("/parametres?reset=ok");
}
