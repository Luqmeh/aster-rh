import type { DemoRole, Employee } from "@/domain/types/hr";

/**
 * Hiérarchie définitive ASTER (permanente) :
 * 1. chef_de_projet — tous droits HR + toutes validations (portée globale)
 * 2. admin_rh — administration RH, lecture des demandes, **sans** décision
 * 3. collaborateur — libre-service personnel uniquement
 */

export type Permission =
  | "employee.directory.browse"
  | "employee.record.view_any"
  | "employee.record.view_self"
  | "employee.record.manage"
  | "employee.record.edit_personal"
  | "hr.administration"
  | "org.manage"
  | "request.leave.view_own"
  | "request.leave.view_all"
  | "request.leave.submit"
  | "request.leave.approve"
  | "request.telework.view_own"
  | "request.telework.view_all"
  | "request.telework.submit"
  | "request.telework.approve"
  | "dashboard.hr"
  | "dashboard.management";

const CHEF: Permission[] = [
  "employee.directory.browse",
  "employee.record.view_any",
  "employee.record.view_self",
  "employee.record.manage",
  "employee.record.edit_personal",
  "hr.administration",
  "org.manage",
  "request.leave.view_own",
  "request.leave.view_all",
  "request.leave.submit",
  "request.leave.approve",
  "request.telework.view_own",
  "request.telework.view_all",
  "request.telework.submit",
  "request.telework.approve",
  "dashboard.hr",
  "dashboard.management",
];

const HR: Permission[] = [
  "employee.directory.browse",
  "employee.record.view_any",
  "employee.record.view_self",
  "employee.record.manage",
  "employee.record.edit_personal",
  "hr.administration",
  "org.manage",
  "request.leave.view_own",
  "request.leave.view_all",
  "request.leave.submit",
  "request.telework.view_own",
  "request.telework.view_all",
  "request.telework.submit",
  "dashboard.hr",
  // pas de *.approve
];

const EMPLOYEE: Permission[] = [
  "employee.record.view_self",
  "employee.record.edit_personal",
  "request.leave.view_own",
  "request.leave.submit",
  "request.telework.view_own",
  "request.telework.submit",
];

const ROLE_PERMISSIONS: Record<DemoRole, ReadonlySet<Permission>> = {
  chef_de_projet: new Set(CHEF),
  admin_rh: new Set(HR),
  collaborateur: new Set(EMPLOYEE),
};

export function hasPermission(role: DemoRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function canApproveRequests(role: DemoRole): boolean {
  return (
    hasPermission(role, "request.leave.approve") ||
    hasPermission(role, "request.telework.approve")
  );
}

export function canBrowseDirectory(role: DemoRole): boolean {
  return hasPermission(role, "employee.directory.browse");
}

export function canManageEmployees(role: DemoRole): boolean {
  return hasPermission(role, "employee.record.manage");
}

export function canAccessHrAdministration(role: DemoRole): boolean {
  return hasPermission(role, "hr.administration");
}

export function canViewAllRequests(role: DemoRole): boolean {
  return (
    hasPermission(role, "request.leave.view_all") ||
    hasPermission(role, "request.telework.view_all")
  );
}

/** Portée globale (Chef de projet) vs soi / équipe historique. */
export function hasGlobalPeopleScope(role: DemoRole): boolean {
  return role === "chef_de_projet" || role === "admin_rh";
}

export function canViewEmployeeProfile(
  role: DemoRole,
  actor: Employee,
  target: Employee,
): boolean {
  if (hasPermission(role, "employee.record.view_any")) return true;
  if (
    hasPermission(role, "employee.record.view_self") &&
    actor.id === target.id
  ) {
    return true;
  }
  return false;
}

export function personalEditableFields(): ReadonlyArray<
  "phoneInternal" | "site"
> {
  return ["phoneInternal", "site"];
}

export function roleLabel(role: DemoRole): string {
  const labels: Record<DemoRole, string> = {
    chef_de_projet: "Chef de projet",
    admin_rh: "Ressources humaines",
    collaborateur: "Collaborateur",
  };
  return labels[role];
}
