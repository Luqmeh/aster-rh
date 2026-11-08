import { auth, signOut as authJsSignOut } from "@/auth";
import type { AuthPort, AuthSession } from "@/infrastructure/auth/types";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { prismaHrRepository } from "@/infrastructure/persistence/prisma-hr-repository";
import {
  isDemoModeEnabled,
  resolvePersistenceMode,
} from "@/infrastructure/persistence/persistence-mode";
import type { DemoRole } from "@/domain/types/hr";

function asRole(value: string | undefined): DemoRole | null {
  if (
    value === "collaborateur" ||
    value === "chef_de_projet" ||
    value === "admin_rh"
  ) {
    return value;
  }
  return null;
}

/**
 * Adaptateur AuthPort — session Auth.js → identité applicative + fiche Employee.
 */
export const sessionAuth: AuthPort = {
  async getSession(): Promise<AuthSession | null> {
    const raw = await auth();
    if (!raw?.user?.id) return null;

    const role = asRole(raw.user.role);
    const employeeId = raw.user.employeeId;
    if (!role || !employeeId) return null;

    const hr =
      resolvePersistenceMode() === "prisma"
        ? prismaHrRepository
        : demoHrRepository;
    const employee = await hr.getEmployee(employeeId);
    if (!employee || !employee.isActive) return null;

    const provider =
      raw.user.authProvider === "entra_id" ? "entra_id" : "credentials";

    return {
      userId: raw.user.id,
      email: raw.user.email ?? employee.email,
      employee,
      role,
      authProvider: provider,
      isDemoMode: isDemoModeEnabled(),
    };
  },

  async signOut() {
    await authJsSignOut({ redirect: false });
  },
};
