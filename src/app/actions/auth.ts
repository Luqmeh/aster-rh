"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { resolveAuthFeatureFlags } from "@/infrastructure/auth/types";
import { sanitizeCallbackUrl } from "@/lib/safe-callback-url";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const flags = resolveAuthFeatureFlags();
  if (!flags.credentialsEnabled) {
    return {
      error:
        "La connexion par identifiants est désactivée. Utilisez Microsoft Entra ID.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = sanitizeCallbackUrl(
    String(formData.get("callbackUrl") ?? ""),
  );

  if (!email || !password) {
    return { error: "E-mail et mot de passe requis." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Identifiants invalides ou compte inactif." };
    }
    // Next.js redirect throws — rethrow
    throw error;
  }

  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/connexion" });
}

export async function entraSignInAction() {
  const flags = resolveAuthFeatureFlags();
  if (!flags.entraEnabled) {
    redirect("/connexion?error=entra_disabled");
  }
  await signIn("microsoft-entra-id", { redirectTo: "/tableau-de-bord" });
}
