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
  | "employee.provision"
  | "employee.lifecycle"
  | "account.role.assign_all"
  | "account.role.assign_collaborateur"
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
  | "recruitment.create"
  | "recruitment.view_all"
  | "recruitment.decide"
  | "recruitment.assign_interviewer"
  | "recruitment.view_assigned"
  | "document_request.submit"
  | "document_request.view_own"
  | "document_request.view_all"
  | "document_request.process"
  | "work_on_holiday.submit"
  | "work_on_holiday.view_own"
  | "work_on_holiday.view_all"
  | "work_on_holiday.approve"
  | "holiday.manage"
  | "hr.reporting"
  | "hr.import.view"
  | "hr.import.execute"
  | "work_absence.submit"
  | "work_absence.view_own"
  | "work_absence.view_all"
  | "work_absence.manage"
  | "work_absence.view_medical_docs"
  | "dashboard.hr"
  | "dashboard.management";

const CHEF: Permission[] = [
  "employee.directory.browse",
  "employee.record.view_any",
  "employee.record.view_self",
  "employee.record.manage",
  "employee.record.edit_personal",
  "employee.provision",
  "employee.lifecycle",
  "account.role.assign_all",
  "account.role.assign_collaborateur",
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
  "recruitment.create",
  "recruitment.view_all",
  "recruitment.decide",
  "recruitment.assign_interviewer",
  "recruitment.view_assigned",
  "document_request.submit",
  "document_request.view_own",
  "document_request.view_all",
  "document_request.process",
  "work_on_holiday.submit",
  "work_on_holiday.view_own",
  "work_on_holiday.view_all",
  "work_on_holiday.approve",
  "holiday.manage",
  "hr.reporting",
  "hr.import.view",
  // Chef : inspection des lots — pas d'exécution d'import
  "work_absence.submit",
  "work_absence.view_own",
  "work_absence.view_all",
  // Chef : vue opérationnelle ; pas de traitement RH ni justificatifs médicaux
  "dashboard.hr",
  "dashboard.management",
];

const HR: Permission[] = [
  "employee.directory.browse",
  "employee.record.view_any",
  "employee.record.view_self",
  "employee.record.manage",
  "employee.record.edit_personal",
  "employee.provision",
  "employee.lifecycle",
  "account.role.assign_collaborateur",
  "hr.administration",
  "org.manage",
  "request.leave.view_own",
  "request.leave.view_all",
  "request.leave.submit",
  "request.telework.view_own",
  "request.telework.view_all",
  "request.telework.submit",
  "recruitment.create",
  "recruitment.view_all",
  "document_request.submit",
  "document_request.view_own",
  "document_request.view_all",
  "document_request.process",
  "work_on_holiday.submit",
  "work_on_holiday.view_own",
  "work_on_holiday.view_all",
  "holiday.manage",
  "hr.reporting",
  "hr.import.view",
  "hr.import.execute",
  "work_absence.submit",
  "work_absence.view_own",
  "work_absence.view_all",
  "work_absence.manage",
  "work_absence.view_medical_docs",
  "dashboard.hr",
  // pas de *.approve / recruitment.decide / work_on_holiday.approve
];

const EMPLOYEE: Permission[] = [
  "employee.record.view_self",
  "employee.record.edit_personal",
  "request.leave.view_own",
  "request.leave.submit",
  "request.telework.view_own",
  "request.telework.submit",
  "recruitment.view_assigned",
  "document_request.submit",
  "document_request.view_own",
  "work_on_holiday.submit",
  "work_on_holiday.view_own",
  "work_absence.submit",
  "work_absence.view_own",
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

/** Consultation des lots d'import Excel (RH + Chef). */
export function canViewHrImport(role: DemoRole): boolean {
  return hasPermission(role, "hr.import.view");
}

/** Exécution d'import Excel — RH uniquement. */
export function canExecuteHrImport(role: DemoRole): boolean {
  return hasPermission(role, "hr.import.execute");
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
    // Alias produit : Senior Manager / Responsable RH (enum DB inchangé).
    chef_de_projet: "Senior Manager",
    admin_rh: "Responsable RH",
    collaborateur: "Collaborateur",
  };
  return labels[role];
}

export function canProvisionEmployees(role: DemoRole): boolean {
  return hasPermission(role, "employee.provision");
}

export function canManageLifecycle(role: DemoRole): boolean {
  return hasPermission(role, "employee.lifecycle");
}

export function canDecideRecruitment(role: DemoRole): boolean {
  return hasPermission(role, "recruitment.decide");
}

export function canManageRecruitment(role: DemoRole): boolean {
  return hasPermission(role, "recruitment.create");
}

export function canViewAllRecruitment(role: DemoRole): boolean {
  return hasPermission(role, "recruitment.view_all");
}

export function canAssignInterviewer(role: DemoRole): boolean {
  return hasPermission(role, "recruitment.assign_interviewer");
}

export function canProcessDocumentRequests(role: DemoRole): boolean {
  return hasPermission(role, "document_request.process");
}

export function canViewAllDocumentRequests(role: DemoRole): boolean {
  return hasPermission(role, "document_request.view_all");
}

export function canApproveWorkOnHoliday(role: DemoRole): boolean {
  return hasPermission(role, "work_on_holiday.approve");
}

export function canViewAllWorkOnHoliday(role: DemoRole): boolean {
  return hasPermission(role, "work_on_holiday.view_all");
}

export function canManageHolidays(role: DemoRole): boolean {
  return hasPermission(role, "holiday.manage");
}

export function canAccessHrReporting(role: DemoRole): boolean {
  return hasPermission(role, "hr.reporting");
}

export function canSubmitWorkAbsence(role: DemoRole): boolean {
  return hasPermission(role, "work_absence.submit");
}

export function canViewAllWorkAbsences(role: DemoRole): boolean {
  return hasPermission(role, "work_absence.view_all");
}

export function canManageWorkAbsences(role: DemoRole): boolean {
  return hasPermission(role, "work_absence.manage");
}

/** Accès aux certificats / justificatifs médicaux privés. */
export function canViewWorkAbsenceMedicalDocs(role: DemoRole): boolean {
  return hasPermission(role, "work_absence.view_medical_docs");
}
