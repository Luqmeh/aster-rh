import {
  canManageEmployees,
  canViewEmployeeProfile,
} from "@/domain/rules/permissions";
import {
  parseEmployeeContract,
  parseEmployeeGrade,
  parseRegion,
} from "@/domain/types/employee-structure";
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
  peopleManagerId?: string;
  region?: string;
  grade?: string;
  status?: "actif" | "inactif" | "parti" | "tous";
};

export type PersonalProfilePatch = Partial<
  Pick<Employee, "phoneInternal">
>;

export type HrEmployeePatch = Partial<
  Pick<
    Employee,
    | "firstName"
    | "lastName"
    | "email"
    | "peopleManagerId"
    | "region"
    | "contractType"
    | "grade"
    | "hireDate"
    | "phoneInternal"
    | "teleworkEligible"
    | "teleworkDaysPerWeek"
  >
>;

function matchesQuery(
  employee: Employee,
  query: string,
  peopleManagerName: string,
): boolean {
  if (!query) return true;
  const hay =
    `${employee.firstName} ${employee.lastName} ${employee.email} ${employee.id} ${peopleManagerName} ${employee.region} ${employee.grade}`.toLowerCase();
  return hay.includes(query);
}

export function createEmployeeService(deps: { hr: HrRepository }) {
  return {
    async listDirectory(session: AuthSession, filters: DirectoryFilters = {}) {
      requireDirectoryAccess(session);
      const [employees, peopleManagers] = await Promise.all([
        deps.hr.listEmployees({
          includeInactive: filters.status !== "actif",
          employmentStatus:
            filters.status && filters.status !== "tous"
              ? filters.status
              : undefined,
        }),
        deps.hr.listPeopleManagers({ includeInactive: true }),
      ]);
      const pmById = Object.fromEntries(peopleManagers.map((p) => [p.id, p]));
      const q = (filters.q ?? "").trim().toLowerCase();
      const regionFilter = (filters.region ?? "").trim().toLowerCase();

      return employees.filter((e) => {
        if (
          filters.peopleManagerId &&
          e.peopleManagerId !== filters.peopleManagerId
        ) {
          return false;
        }
        if (filters.grade && e.grade !== filters.grade) {
          return false;
        }
        if (regionFilter && !e.region.toLowerCase().includes(regionFilter)) {
          return false;
        }

        const pmName = e.peopleManagerId
          ? (pmById[e.peopleManagerId]?.displayName ?? "")
          : "";
        return matchesQuery(e, q, pmName);
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
      if ("isActive" in (patch as object) || "employmentStatus" in (patch as object)) {
        throw new AuthError(
          "Le cycle de vie (actif / inactif / parti) se gère via l'action dédiée, pas la fiche.",
          403,
        );
      }

      const {
        firstName,
        lastName,
        email,
        peopleManagerId,
        region,
        contractType,
        grade,
        hireDate,
        phoneInternal,
        teleworkEligible,
        teleworkDaysPerWeek,
      } = patch;

      let resolvedGrade = grade;
      if (grade !== undefined) {
        const gradeParsed = parseEmployeeGrade(String(grade));
        if (!gradeParsed.ok) throw new Error(gradeParsed.message);
        resolvedGrade = gradeParsed.value;
      }

      let resolvedRegion = region;
      if (region !== undefined) {
        const regionParsed = parseRegion(region);
        if (!regionParsed.ok) throw new Error(regionParsed.message);
        resolvedRegion = regionParsed.value;
      }

      let resolvedContract = contractType;
      if (contractType !== undefined) {
        const contractParsed = parseEmployeeContract(String(contractType));
        if (!contractParsed.ok) throw new Error(contractParsed.message);
        resolvedContract = contractParsed.value;
      }

      let managerId: string | null | undefined;
      if (peopleManagerId !== undefined) {
        if (peopleManagerId) {
          const pm = await deps.hr.getPeopleManager(peopleManagerId);
          if (!pm || !pm.isActive) {
            throw new Error("People Manager introuvable ou inactif.");
          }
          managerId = pm.linkedEmployeeId;
        } else {
          managerId = null;
        }
      }

      return deps.hr.updateEmployee(employeeId, {
        firstName,
        lastName,
        email,
        jobTitle: "",
        departmentId: null,
        peopleManagerId,
        managerId,
        region: resolvedRegion,
        contractType: resolvedContract,
        grade: resolvedGrade,
        hireDate,
        phoneInternal,
        teleworkEligible,
        teleworkDaysPerWeek,
      });
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
