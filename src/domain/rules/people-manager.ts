import { z } from "zod";
import {
  peopleManagerDisplayNameSchema,
  type PeopleManagerEntry,
} from "@/domain/types/employee-structure";
import type { DemoRole, Employee } from "@/domain/types/hr";
import { canProvisionEmployees } from "@/domain/rules/permissions";

/**
 * People Manager — catalogue organisationnel.
 * L'affectation n'accorde aucune autorité d'approbation (voir approvals.ts).
 */

export const createPeopleManagerInputSchema = z.object({
  displayName: peopleManagerDisplayNameSchema,
  linkedEmployeeId: z.string().trim().min(1).nullable().optional(),
});

export type CreatePeopleManagerInput = z.infer<
  typeof createPeopleManagerInputSchema
>;

export function canManagePeopleManagerCatalog(role: DemoRole): boolean {
  return canProvisionEmployees(role);
}

export function assertCanManagePeopleManagerCatalog(role: DemoRole): void {
  if (!canManagePeopleManagerCatalog(role)) {
    throw new Error(
      "La gestion du catalogue People Manager est réservée au Responsable RH et au Senior Manager.",
    );
  }
}

export function resolvePeopleManagerDisplayName(input: {
  displayName: string;
  linkedEmployee: Employee | null;
}): string {
  if (input.linkedEmployee) {
    const fromEmployee = `${input.linkedEmployee.firstName} ${input.linkedEmployee.lastName}`.trim();
    return input.displayName.trim() || fromEmployee;
  }
  return input.displayName.trim();
}

/** Résolution import : matricule / e-mail / nom exact d'un collaborateur ASTER. */
export function matchEmployeeForPeopleManager(
  employees: Employee[],
  raw: string,
): Employee | null {
  const needle = raw.trim().toLowerCase();
  if (!needle) return null;
  const byId = employees.find((e) => e.id.toLowerCase() === needle);
  if (byId) return byId;
  const byEmail = employees.find((e) => e.email.toLowerCase() === needle);
  if (byEmail) return byEmail;
  const byFullName = employees.find(
    (e) => `${e.firstName} ${e.lastName}`.trim().toLowerCase() === needle,
  );
  return byFullName ?? null;
}

export function peopleManagerLabel(
  entry: PeopleManagerEntry | null | undefined,
): string {
  if (!entry) return "—";
  return entry.displayName;
}
