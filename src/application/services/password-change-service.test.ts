import { beforeEach, describe, expect, it } from "vitest";
import { createEmployeeProvisioningService } from "@/application/services/employee-provisioning-service";
import { createPasswordChangeService } from "@/application/services/password-change-service";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import {
  findAccountByEmail,
  resetMemoryAccountsForTests,
} from "@/infrastructure/auth/account-store";
import { verifyPassword } from "@/infrastructure/auth/password";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import type { AuthSession } from "@/infrastructure/auth/types";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

const email = {
  async send() {
    return { queued: true as const, provider: "mock-email" };
  },
};

describe("password-change-service + first login", () => {
  beforeEach(() => {
    resetDemoStore();
    resetMemoryAccountsForTests();
  });

  async function provisionCollaborator(temporaryPassword = "Aster-TempPass1") {
    const service = createEmployeeProvisioningService({
      hr: demoHrRepository,
      email,
    });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    const result = await service.onboard(chef, {
      id: "emp-pwd-1",
      firstName: "Ana",
      lastName: "Test",
      email: "ana.test@demo.aster-rh.local",
      jobTitle: "Consultante",
      departmentId: "dept-audit",
      peopleManagerId: "pm-from-emp-julien",
      region: "Casablanca",
      contractType: "cdi",
      grade: "auditeur_senior",
      hireDate: "2026-11-01",
      temporaryPassword,
      role: "collaborateur",
    });
    const account = await findAccountByEmail("ana.test@demo.aster-rh.local");
    expect(account?.mustChangePassword).toBe(true);
    const employee = await demoHrRepository.getEmployee("emp-pwd-1");
    if (!employee || !account) throw new Error("setup failed");
    const session: AuthSession = {
      userId: account.id,
      email: account.email,
      employee,
      role: account.role,
      authProvider: "credentials",
      mustChangePassword: account.mustChangePassword,
      isDemoMode: true,
    };
    return { result, account, session, temporaryPassword };
  }

  it("pose mustChangePassword=true à la création avec mot de passe temporaire", async () => {
    const { account } = await provisionCollaborator();
    expect(account.mustChangePassword).toBe(true);
  });

  it("bloque requireSession tant que le flag est actif", async () => {
    const { session } = await provisionCollaborator();
    expect(() => requireSession(session)).toThrow(AuthError);
    expect(() =>
      requireSession(session, { allowMustChangePassword: true }),
    ).not.toThrow();
  });

  it("refuse un mot de passe actuel incorrect", async () => {
    const { session } = await provisionCollaborator();
    const service = createPasswordChangeService();
    await expect(
      service.changeOwnPassword(session, {
        currentPassword: "wrong-password",
        newPassword: "NouveauSecure1",
        confirmPassword: "NouveauSecure1",
      }),
    ).rejects.toThrow(/actuel incorrect/i);
  });

  it("refuse un nouveau mot de passe faible ou non confirmé", async () => {
    const { session, temporaryPassword } = await provisionCollaborator();
    const service = createPasswordChangeService();
    await expect(
      service.changeOwnPassword(session, {
        currentPassword: temporaryPassword,
        newPassword: "short1",
        confirmPassword: "short1",
      }),
    ).rejects.toThrow(/10/);
    await expect(
      service.changeOwnPassword(session, {
        currentPassword: temporaryPassword,
        newPassword: "NouveauSecure1",
        confirmPassword: "AutreSecure1",
      }),
    ).rejects.toThrow(/confirmation/i);
  });

  it(
    "met à jour le hash et efface le flag après succès",
    { timeout: 20_000 },
    async () => {
      const { session, temporaryPassword } = await provisionCollaborator();
      const service = createPasswordChangeService();
      const updated = await service.changeOwnPassword(session, {
        currentPassword: temporaryPassword,
        newPassword: "NouveauSecure1",
        confirmPassword: "NouveauSecure1",
      });
      expect(updated.mustChangePassword).toBe(false);
      const account = await findAccountByEmail("ana.test@demo.aster-rh.local");
      expect(account?.mustChangePassword).toBe(false);
      expect(account?.passwordHash).toBeTruthy();
      expect(
        await verifyPassword("NouveauSecure1", account!.passwordHash!),
      ).toBe(true);
      expect(
        await verifyPassword(temporaryPassword, account!.passwordHash!),
      ).toBe(false);
    },
  );

  it("laisse les comptes seed sans flag accéder normalement", () => {
    const lea = testSessionFor("emp-lea", "collaborateur");
    expect(lea.mustChangePassword).toBe(false);
    expect(() => requireSession(lea)).not.toThrow();
  });

  it("reprovisionne un mot de passe temporaire perdu", async () => {
    const { account } = await provisionCollaborator();
    const provisioning = createEmployeeProvisioningService({
      hr: demoHrRepository,
      email,
    });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    await createPasswordChangeService().changeOwnPassword(
      {
        userId: account.id,
        email: account.email,
        employee: (await demoHrRepository.getEmployee("emp-pwd-1"))!,
        role: "collaborateur",
        authProvider: "credentials",
        mustChangePassword: true,
        isDemoMode: true,
      },
      {
        currentPassword: "Aster-TempPass1",
        newPassword: "NouveauSecure1",
        confirmPassword: "NouveauSecure1",
      },
    );
    const reset = await provisioning.reprovisionTemporaryPassword(
      chef,
      "emp-pwd-1",
    );
    expect(reset.temporaryPassword).toBeTruthy();
    const refreshed = await findAccountByEmail(account.email);
    expect(refreshed?.mustChangePassword).toBe(true);
  });
});
