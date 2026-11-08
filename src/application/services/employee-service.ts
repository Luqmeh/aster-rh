import {
  canManageEmployees,
  canViewEmployeeProfile,
} from "@/domain/rules/permissions";
import type { Employee } from "@/domain/types/hr";
import {
  AuthError,
  requireDirectoryAccess,
  requireEmployeeAccess,
  requireEmployeeManagement,
  requireSession,
} from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

export type DirectoryFilters = {
  q?: string;
  departmentId?: string;
  managerId?: string;
  status?: "actif" | "inactif" | "parti" | "tous";
};

export type PersonalProfilePatch = Partial<
  Pick<Employee, "phoneInternal" | "site">
>;

export type HrEmployeePatch = Partial<
  Pick<
    Employee,
    | "firstName"
    | "lastName"
    | "email"
    | "jobTitle"
    | "departmentId"
    | "managerId"
    | "site"
    | "contractType"
    | "category"
    | "hireDate"
    | "isActive"
    | "phoneInternal"
    | "teleworkEligible"
    | "teleworkDaysPerWeek"
  >
>;

function matchesQuery(
  employee: Employee,
  query: string,
  deptName: string,
  managerName: string,
): boolean {
  if (!query) return true;
  const hay =
    `${employee.firstName} ${employee.lastName} ${employee.email} ${employee.id} ${employee.jobTitle} ${deptName} ${managerName} ${employee.site}`.toLowerCase();
  return hay.includes(query);
}

export function createEmployeeService(deps: { hr: HrRepository }) {
  return {
    async listDirectory(session: AuthSession, filters: DirectoryFilters = {}) {
      requireDirectoryAccess(session);
      const [employees, departments] = await Promise.all([
        deps.hr.listEmployees({
          includeInactive: filters.status !== "actif",
          employmentStatus:
            filters.status && filters.status !== "tous"
              ? filters.status
              : undefined,
        }),
        deps.hr.listDepartments(),
      ]);
      const deptById = Object.fromEntries(departments.map((d) => [d.id, d]));
      const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
      const q = (filters.q ?? "").trim().toLowerCase();

      return employees.filter((e) => {
        if (filters.departmentId && e.departmentId !== filters.departmentId) {
          return false;
        }
        if (filters.managerId && e.managerId !== filters.managerId) {
          return false;
        }

        const manager = e.managerId ? byId[e.managerId] : null;
        const managerName = manager
          ? `${manager.firstName} ${manager.lastName}`
          : "";
        return matchesQuery(
          e,
          q,
          deptById[e.departmentId]?.name ?? "",
          managerName,
        );
      });
    },

    async getProfile(session: AuthSession, employeeId: string) {
      const target = await deps.hr.getEmployee(employeeId);
      if (!target) throw new AuthError("Collaborateur introuvable.", 404);
      requireEmployeeAccess(session, target);
      return target;
    },

    async updatePersonal(
      session: AuthSession,
      employeeId: string,
      patch: PersonalProfilePatch,
    ) {
      requireSession(session);
      const target = await deps.hr.getEmployee(employeeId);
      if (!target) throw new AuthError("Collaborateur introuvable.", 404);

      if (session.employee.id !== target.id) {
        throw new AuthError(
          "Vous ne pouvez modifier que vos informations personnelles.",
          403,
        );
      }

      const sanitized: PersonalProfilePatch = {};
      if (patch.phoneInternal !== undefined) {
        sanitized.phoneInternal = patch.phoneInternal;
      }
      if (patch.site !== undefined) {
        sanitized.site = patch.site;
      }
      return deps.hr.updateEmployee(employeeId, sanitized);
    },

    async updateHrRecord(
      session: AuthSession,
      employeeId: string,
      patch: HrEmployeePatch,
    ) {
      requireEmployeeManagement(session);
      const target = await deps.hr.getEmployee(employeeId);
      if (!target) throw new AuthError("Collaborateur introuvable.", 404);

      if ("role" in (patch as object)) {
        throw new AuthError(
          "Le rôle applicatif ne se modifie pas depuis la fiche collaborateur.",
          403,
        );
      }

      return deps.hr.updateEmployee(employeeId, patch);
    },

    canView(session: AuthSession, target: Employee) {
      return canViewEmployeeProfile(session.role, session.employee, target);
    },

    canManage(session: AuthSession) {
      return canManageEmployees(session.role);
    },
  };
}

export type EmployeeService = ReturnType<typeof createEmployeeService>;
