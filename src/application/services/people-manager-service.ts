import { canManagePeopleManagers } from "@/domain/rules/permissions";
import {
  peopleManagerDisplayNameSchema,
  type PeopleManagerEntry,
} from "@/domain/types/employee-structure";
import type { Employee } from "@/domain/types/hr";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

function requireCatalogAccess(session: AuthSession): void {
  requireSession(session);
  if (!canManagePeopleManagers(session.role)) {
    throw new AuthError(
      "Gestion du catalogue People Manager réservée au Responsable RH et au Senior Manager.",
      403,
    );
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Valide l'affectation d'un People Manager à un collaborateur (catalogue actif).
 * L'affectation est organisationnelle : elle n'accorde aucune autorité d'approbation.
 */
export async function resolveAssignablePeopleManagerId(
  hr: Pick<HrRepository, "getPeopleManager">,
  raw: string | null | undefined,
): Promise<string | null> {
  const id = (raw ?? "").trim();
  if (!id) return null;
  const entry = await hr.getPeopleManager(id);
  if (!entry || !entry.isActive) {
    throw new Error("People Manager introuvable ou inactif dans le catalogue.");
  }
  return entry.id;
}

/** Collaborateur lié au People Manager d'un employé (notifications / équipe uniquement). */
export async function resolvePeopleManagerEmployee(
  hr: Pick<HrRepository, "getPeopleManager" | "getEmployee">,
  employee: Pick<Employee, "peopleManagerId" | "managerId">,
): Promise<Employee | null> {
  if (employee.peopleManagerId) {
    const entry = await hr.getPeopleManager(employee.peopleManagerId);
    if (entry?.linkedEmployeeId) {
      const linked = await hr.getEmployee(entry.linkedEmployeeId);
      if (linked) return linked;
    }
    return null;
  }
  if (employee.managerId) return hr.getEmployee(employee.managerId);
  return null;
}

export function createPeopleManagerService(deps: { hr: HrRepository }) {
  return {
    async list(
      session: AuthSession,
      options?: { includeInactive?: boolean },
    ): Promise<PeopleManagerEntry[]> {
      requireCatalogAccess(session);
      return deps.hr.listPeopleManagers(options);
    },

    async create(
      session: AuthSession,
      input: { displayName: string; linkedEmployeeId?: string | null },
    ): Promise<PeopleManagerEntry> {
      requireCatalogAccess(session);
      const name = peopleManagerDisplayNameSchema.safeParse(input.displayName);
      if (!name.success) {
        throw new Error(
          name.error.issues[0]?.message ?? "Nom du People Manager invalide.",
        );
      }
      const displayName = name.data.replace(/\s+/g, " ");

      const linkedEmployeeId = input.linkedEmployeeId?.trim() || null;
      if (linkedEmployeeId) {
        const linked = await deps.hr.getEmployee(linkedEmployeeId);
        if (!linked) {
          throw new Error("Collaborateur lié introuvable.");
        }
      }

      const existing = await deps.hr.listPeopleManagers({
        includeInactive: true,
      });
      if (
        existing.some(
          (e) => normalizeName(e.displayName) === normalizeName(displayName),
        )
      ) {
        throw new Error("Un People Manager portant ce nom existe déjà.");
      }

      return deps.hr.createPeopleManager({ displayName, linkedEmployeeId });
    },

    async update(
      session: AuthSession,
      id: string,
      patch: {
        displayName?: string;
        linkedEmployeeId?: string | null;
        isActive?: boolean;
      },
    ): Promise<PeopleManagerEntry> {
      requireCatalogAccess(session);
      const current = await deps.hr.getPeopleManager(id);
      if (!current) throw new Error("People Manager introuvable.");

      const next: {
        displayName?: string;
        linkedEmployeeId?: string | null;
        isActive?: boolean;
      } = {};
      if (patch.displayName !== undefined) {
        const name = peopleManagerDisplayNameSchema.safeParse(
          patch.displayName,
        );
        if (!name.success) {
          throw new Error(
            name.error.issues[0]?.message ?? "Nom du People Manager invalide.",
          );
        }
        next.displayName = name.data.replace(/\s+/g, " ");
      }
      if (patch.linkedEmployeeId !== undefined) {
        const linkedId = patch.linkedEmployeeId?.trim() || null;
        if (linkedId && !(await deps.hr.getEmployee(linkedId))) {
          throw new Error("Collaborateur lié introuvable.");
        }
        next.linkedEmployeeId = linkedId;
      }
      if (patch.isActive !== undefined) next.isActive = patch.isActive;

      return deps.hr.updatePeopleManager(id, next);
    },
  };
}

export type PeopleManagerService = ReturnType<
  typeof createPeopleManagerService
>;
