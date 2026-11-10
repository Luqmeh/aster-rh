import type { DemoRole, Employee } from "@/domain/types/hr";
import {
  canAccessHrAdministration,
  canBrowseDirectory,
  canManageEmployees,
  canViewEmployeeProfile,
  hasPermission,
  type Permission,
} from "@/domain/rules/permissions";
import type { AuthSession } from "@/infrastructure/auth/types";

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type RequireSessionOptions = {
  /** Autorise les actions minimales pendant le premier changement de mot de passe. */
  allowMustChangePassword?: boolean;
};

export function requireSession(
  session: AuthSession | null,
  options?: RequireSessionOptions,
): AuthSession {
  if (!session) {
    throw new AuthError("Authentification requise.", 401);
  }
  if (!session.employee.isActive) {
    throw new AuthError("Compte collaborateur inactif.", 403);
  }
  if (session.mustChangePassword && !options?.allowMustChangePassword) {
    throw new AuthError(
      "Vous devez changer votre mot de passe temporaire avant d'accéder à l'application.",
      403,
    );
  }
  return session;
}

export function requireRole(
  session: AuthSession,
  allowed: DemoRole | DemoRole[],
): void {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(session.role)) {
    throw new AuthError("Accès refusé pour votre rôle.", 403);
  }
}

export function requirePermission(
  session: AuthSession,
  permission: Permission,
): void {
  if (!hasPermission(session.role, permission)) {
    throw new AuthError("Permission insuffisante.", 403);
  }
}

export function canAccessEmployeeRecord(
  session: AuthSession,
  target: Employee,
): boolean {
  return canViewEmployeeProfile(session.role, session.employee, target);
}

export function requireEmployeeAccess(
  session: AuthSession,
  target: Employee,
): void {
  if (!canAccessEmployeeRecord(session, target)) {
    throw new AuthError(
      "Vous n'êtes pas autorisé à consulter ce collaborateur.",
      403,
    );
  }
}

export function requireDirectoryAccess(session: AuthSession): void {
  if (!canBrowseDirectory(session.role)) {
    throw new AuthError("Annuaire réservé aux rôles RH et Chef de projet.", 403);
  }
}

export function requireEmployeeManagement(session: AuthSession): void {
  if (!canManageEmployees(session.role)) {
    throw new AuthError("Gestion des fiches réservée aux rôles autorisés.", 403);
  }
}

export function isRouteAllowedForRole(
  pathname: string,
  role: DemoRole,
): boolean {
  if (pathname.startsWith("/administration")) {
    return canAccessHrAdministration(role);
  }
  if (pathname.startsWith("/annuaire")) {
    return canBrowseDirectory(role);
  }
  return true;
}

export function dashboardPathForRole(): string {
  return "/tableau-de-bord";
}
