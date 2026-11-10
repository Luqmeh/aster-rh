import type { DemoRole, Employee } from "@/domain/types/hr";

export type AuthProviderKind = "credentials" | "entra_id";

/**
 * Identité applicative résolue côté serveur — indépendante du fournisseur
 * (credentials temporaires ou Microsoft Entra ID).
 */
export interface AuthSession {
  userId: string;
  email: string;
  employee: Employee;
  role: DemoRole;
  authProvider: AuthProviderKind;
  /**
   * true tant qu'un mot de passe temporaire n'a pas été changé.
   * Relu depuis UserAccount (pas seulement le JWT).
   */
  mustChangePassword: boolean;
  /** true uniquement si ASTER_MODE=demo (reset démo UI) — pas une preuve d'auth. */
  isDemoMode: boolean;
}

export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

export type AuthFeatureFlags = {
  credentialsEnabled: boolean;
  entraEnabled: boolean;
};

export function resolveAuthFeatureFlags(
  env: Record<string, string | undefined> = process.env,
): AuthFeatureFlags {
  const credentialsExplicit = env.ASTER_CREDENTIALS_AUTH?.trim().toLowerCase();
  const entraExplicit = env.ASTER_ENTRA_AUTH?.trim().toLowerCase();

  const entraConfigured = Boolean(
    env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() &&
      env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() &&
      env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim(),
  );

  return {
    // Activé par défaut pour le prototype sauf désactivation explicite.
    credentialsEnabled: credentialsExplicit
      ? credentialsExplicit === "1" || credentialsExplicit === "true"
      : true,
    // Entra uniquement si flag + configuration complète (jamais « faux actif »).
    entraEnabled:
      (entraExplicit === "1" || entraExplicit === "true") && entraConfigured,
  };
}
