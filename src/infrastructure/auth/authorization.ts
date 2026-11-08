import type { DemoRole, Employee } from "@/domain/types/hr";
import type { AuthSession } from "@/infrastructure/auth/types";

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function requireSession(session: AuthSession | null): AuthSession {
  if (!session) {
    throw new AuthError("Authentification requise.", 401);
  }
  if (!session.employee.isActive) {
    throw new AuthError("Compte collaborateur inactif.", 403);
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

/** Accès à une fiche : soi-même, manager d’équipe, ou RH. */
export function canAccessEmployeeRecord(
  session: AuthSession,
  target: Employee,
): boolean {
  if (session.role === "admin_rh") return true;
  if (session.employee.id === target.id) return true;
  if (session.role === "manager" && target.managerId === session.employee.id) {
    return true;
  }
  return false;
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

export function requireManagerOf(
  session: AuthSession,
  subject: Employee,
): void {
  requireRole(session, "manager");
  if (subject.managerId !== session.employee.id) {
    throw new AuthError(
      "Cette demande n'appartient pas à votre équipe.",
      403,
    );
  }
}

export function dashboardPathForRole(): string {
  return "/tableau-de-bord";
}

export function isRouteAllowedForRole(
  pathname: string,
  role: DemoRole,
): boolean {
  if (pathname.startsWith("/administration")) {
    return role === "admin_rh";
  }
  return true;
}
