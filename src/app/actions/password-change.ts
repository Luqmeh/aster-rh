"use server";

import { redirect } from "next/navigation";
import { unstable_update } from "@/auth";
import { createPasswordChangeService } from "@/application/services/password-change-service";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

export type ChangePasswordState = {
  error?: string;
};

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const container = getContainer();
  let session;
  try {
    session = requireSession(await container.auth.getSession(), {
      allowMustChangePassword: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    const service = createPasswordChangeService();
    await service.changeOwnPassword(session, {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de changer le mot de passe.",
    };
  }

  // Auth.js type Partial<Session | { user }> doesn't widen custom user fields cleanly.
  await unstable_update({
    user: { mustChangePassword: false },
  } as Parameters<typeof unstable_update>[0]);

  redirect("/tableau-de-bord");
}
