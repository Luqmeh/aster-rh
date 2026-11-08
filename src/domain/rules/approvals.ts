import type { DemoRole, Employee, RequestStatus } from "@/domain/types/hr";
import {
  canApproveRequests,
  roleLabel as permissionRoleLabel,
} from "@/domain/rules/permissions";

/**
 * Circuit d'approbation :
 * Collaborateur → file validation → Chef de projet (portée globale).
 * RH voit les demandes mais ne décide pas.
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

/** @deprecated Préférer canApproveRequests + assertCanDecideRequest. */
export function canApproveAsManager(
  actor: Employee,
  subject: Employee,
  status: RequestStatus,
): boolean {
  if (status !== "en_attente_manager" && status !== "en_attente_rh") {
    return false;
  }
  if (!actor.isActive) return false;
  // Conservé pour tests historiques d'équipe — le Chef de projet a portée globale.
  return subject.managerId === actor.id;
}

export function canApproveAsHrAdmin(
  role: DemoRole,
  status: RequestStatus,
): boolean {
  void role;
  void status;
  // RH n'a jamais d'autorité de décision sur les validations.
  return false;
}

/**
 * Décision autorisée — uniquement Chef de projet (portée globale).
 */
export function assertCanDecideRequest(input: {
  role: DemoRole;
  actor: Employee;
  subject: Employee;
  status: RequestStatus;
}):
  | { ok: true; mode: "chef_de_projet" }
  | { ok: false; message: string } {
  if (isTerminalRequestStatus(input.status)) {
    return {
      ok: false,
      message: "Cette demande a déjà été traitée.",
    };
  }

  if (!input.actor.isActive) {
    return {
      ok: false,
      message: "Votre compte est inactif.",
    };
  }

  if (input.role === "collaborateur") {
    return {
      ok: false,
      message: "Action réservée au Chef de projet.",
    };
  }

  if (input.role === "admin_rh") {
    return {
      ok: false,
      message:
        "Les ressources humaines peuvent consulter les demandes mais ne peuvent pas les approuver ni les refuser.",
    };
  }

  if (
    input.role === "chef_de_projet" &&
    canApproveRequests(input.role) &&
    (input.status === "en_attente_manager" ||
      input.status === "en_attente_rh")
  ) {
    return { ok: true, mode: "chef_de_projet" };
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

export function nextStatusAfterHrDecision(decision: Decision): RequestStatus {
  return decision === "refusee" ? "refusee" : "approuvee";
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
      defaultBody: "Votre demande a été traitée.",
    };
  }
  return {
    title:
      decision === "approuvee"
        ? "Plan de télétravail approuvé"
        : "Plan de télétravail refusé",
    defaultBody: "Votre plan mensuel a été traité.",
  };
}

export function statusLabel(status: RequestStatus): string {
  const labels: Record<RequestStatus, string> = {
    brouillon: "Brouillon",
    soumise: "Soumise",
    en_attente_manager: "En attente de validation",
    en_attente_rh: "En attente RH",
    approuvee: "Approuvée",
    refusee: "Refusée",
    annulee: "Annulée",
  };
  return labels[status];
}

export function roleLabel(role: DemoRole): string {
  return permissionRoleLabel(role);
}
