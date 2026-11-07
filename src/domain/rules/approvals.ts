import type { DemoRole, Employee, RequestStatus } from "@/domain/types/hr";

/**
 * Circuit d'approbation de démonstration :
 * Collaborateur → Manager → (optionnel RH pour certains cas)
 *
 * Le circuit réel PKF Arsilon doit être documenté dans docs/HR_REQUIREMENTS.md.
 */

export type Decision = "approuvee" | "refusee";

const TERMINAL_STATUSES: RequestStatus[] = [
  "approuvee",
  "refusee",
  "annulee",
];

export function initialStatusAfterSubmit(): RequestStatus {
  return "en_attente_manager";
}

export function isTerminalRequestStatus(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canApproveAsManager(
  actor: Employee,
  subject: Employee,
  status: RequestStatus,
): boolean {
  if (status !== "en_attente_manager") return false;
  if (!actor.isActive) return false;
  return subject.managerId === actor.id;
}

export function canApproveAsHrAdmin(
  role: DemoRole,
  status: RequestStatus,
): boolean {
  return role === "admin_rh" && status === "en_attente_rh";
}

/**
 * Décision autorisée pour le circuit de démo manager (et admin RH en file manager).
 * Messages d'erreur en français, adaptés à la démo.
 */
export function assertCanDecideRequest(input: {
  role: DemoRole;
  actor: Employee;
  subject: Employee;
  status: RequestStatus;
}): { ok: true; mode: "manager" | "admin_rh" } | { ok: false; message: string } {
  if (isTerminalRequestStatus(input.status)) {
    return {
      ok: false,
      message: "Cette demande a déjà été traitée.",
    };
  }

  if (input.role === "collaborateur") {
    return {
      ok: false,
      message: "Action réservée au manager ou à l'administrateur RH.",
    };
  }

  if (input.status !== "en_attente_manager") {
    return {
      ok: false,
      message: "Cette demande n'est pas en attente de validation manager.",
    };
  }

  if (!input.actor.isActive) {
    return {
      ok: false,
      message: "Votre compte de démonstration est inactif.",
    };
  }

  if (canApproveAsManager(input.actor, input.subject, input.status)) {
    return { ok: true, mode: "manager" };
  }

  if (input.role === "admin_rh") {
    return { ok: true, mode: "admin_rh" };
  }

  return {
    ok: false,
    message: "Vous n'êtes pas autorisé à traiter cette demande.",
  };
}

export function nextStatusAfterManagerDecision(
  decision: Decision,
  escalateToHr: boolean,
): RequestStatus {
  if (decision === "refusee") return "refusee";
  return escalateToHr ? "en_attente_rh" : "approuvee";
}

export function decisionNotificationCopy(
  kind: "leave" | "telework",
  decision: Decision,
): { title: string; defaultBody: string } {
  if (kind === "leave") {
    return {
      title:
        decision === "approuvee"
          ? "Demande de congés approuvée"
          : "Demande de congés refusée",
      defaultBody: "Votre manager a traité votre demande.",
    };
  }
  return {
    title:
      decision === "approuvee"
        ? "Plan de télétravail approuvé"
        : "Plan de télétravail refusé",
    defaultBody: "Votre manager a traité votre plan mensuel.",
  };
}

export function statusLabel(status: RequestStatus): string {
  const labels: Record<RequestStatus, string> = {
    brouillon: "Brouillon",
    soumise: "Soumise",
    en_attente_manager: "En attente manager",
    en_attente_rh: "En attente RH",
    approuvee: "Approuvée",
    refusee: "Refusée",
    annulee: "Annulée",
  };
  return labels[status];
}

export function roleLabel(role: DemoRole): string {
  const labels: Record<DemoRole, string> = {
    collaborateur: "Collaborateur",
    manager: "Manager / Team Leader",
    admin_rh: "Administrateur RH",
  };
  return labels[role];
}
