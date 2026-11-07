import type { DemoIdentity, DemoRole, Employee } from "@/domain/types/hr";

/**
 * Port d'authentification — remplaçable par un adaptateur Microsoft Entra ID.
 * L'implémentation actuelle est exclusivement un mode DÉMONSTRATION.
 */
export interface AuthSession {
  /** Toujours true en mode démo pour signaler clairement le contexte. */
  isDemo: true;
  identity: DemoIdentity;
  employee: Employee;
  role: DemoRole;
}

export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  switchDemoIdentity(identityId: string): Promise<AuthSession>;
  listDemoIdentities(): Promise<DemoIdentity[]>;
  /** Réservé à l'adaptateur Entra — non implémenté en démo. */
  signIn?(): Promise<never>;
  signOut?(): Promise<void>;
}
