import { auth, signOut as authJsSignOut } from "@/auth";
import type { AuthPort, AuthSession } from "@/infrastructure/auth/types";
import { findAccountById } from "@/infrastructure/auth/account-store";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { prismaHrRepository } from "@/infrastructure/persistence/prisma-hr-repository";
import {
  isDemoModeEnabled,
  resolvePersistenceMode,
} from "@/infrastructure/persistence/persistence-mode";
import type { DemoRole } from "@/domain/types/hr";

function asRole(value: string | undefined | null): DemoRole | null {
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
 * Le rôle et l'activation sont toujours relus depuis UserAccount (anti-élévation JWT périmé).
 */
export const sessionAuth: AuthPort = {
  async getSession(): Promise<AuthSession | null> {
    const raw = await auth();
    if (!raw?.user?.id) return null;

    const employeeId = raw.user.employeeId;
    if (!employeeId) return null;

    const account = await findAccountById(raw.user.id);
    if (!account || !account.isActive) return null;
    if (account.employeeId !== employeeId) return null;

    const role = asRole(account.role);
    if (!role) return null;

    const hr =
      resolvePersistenceMode() === "prisma"
        ? prismaHrRepository
        : demoHrRepository;
    const employee = await hr.getEmployee(employeeId);
    if (!employee || !employee.isActive) return null;

    const provider =
      account.authProvider === "entra_id" ||
      raw.user.authProvider === "entra_id"
        ? "entra_id"
        : "credentials";

    return {
      userId: account.id,
      email: account.email || raw.user.email || employee.email,
      employee,
      role,
      authProvider: provider,
      mustChangePassword: account.mustChangePassword,
      isDemoMode: isDemoModeEnabled(),
    };
  },

  async signOut() {
    await authJsSignOut({ redirect: false });
  },
};
