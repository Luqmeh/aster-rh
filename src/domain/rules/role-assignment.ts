import type { DemoRole } from "@/domain/types/hr";

const PRIVILEGED: DemoRole[] = ["chef_de_projet", "admin_rh"];

export function isPrivilegedRole(role: DemoRole): boolean {
  return PRIVILEGED.includes(role);
}

/**
 * RH ne peut provisionner / assigner que Collaborateur.
 * Chef de projet peut assigner tous les rôles.
 */
export function canAssignRole(
  actorRole: DemoRole,
  targetRole: DemoRole,
): boolean {
  if (actorRole === "chef_de_projet") return true;
  if (actorRole === "admin_rh") return targetRole === "collaborateur";
  return false;
}

export function canModifyAccountRole(
  actorRole: DemoRole,
  currentTargetRole: DemoRole,
  nextTargetRole: DemoRole,
): { ok: true } | { ok: false; message: string } {
  if (!canAssignRole(actorRole, nextTargetRole)) {
    return {
      ok: false,
      message:
        actorRole === "admin_rh"
          ? "Les ressources humaines ne peuvent pas attribuer de rôles privilégiés."
          : "Permission insuffisante pour modifier ce rôle.",
    };
  }
  if (
    actorRole === "admin_rh" &&
    isPrivilegedRole(currentTargetRole)
  ) {
    return {
      ok: false,
      message:
        "Les ressources humaines ne peuvent pas modifier un compte privilégié.",
    };
  }
  return { ok: true };
}
