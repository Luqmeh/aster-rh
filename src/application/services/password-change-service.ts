import { validateNewPassword } from "@/domain/rules/password-policy";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import {
  findAccountById,
  updateUserAccount,
} from "@/infrastructure/auth/account-store";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";
import type { AuthSession } from "@/infrastructure/auth/types";

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function createPasswordChangeService() {
  return {
    async changeOwnPassword(session: AuthSession, raw: ChangePasswordInput) {
      requireSession(session, { allowMustChangePassword: true });

      const currentPassword = raw.currentPassword ?? "";
      const newPassword = raw.newPassword ?? "";
      const confirmPassword = raw.confirmPassword ?? "";

      if (!currentPassword) {
        throw new Error("Le mot de passe actuel est requis.");
      }

      const policy = validateNewPassword(newPassword, confirmPassword, {
        currentPassword,
      });
      if (!policy.ok) {
        throw new Error(policy.message);
      }

      const account = await findAccountById(session.userId);
      if (!account || !account.isActive) {
        throw new AuthError("Compte introuvable ou inactif.", 403);
      }
      if (account.employeeId !== session.employee.id) {
        throw new AuthError(
          "Vous ne pouvez modifier que votre propre mot de passe.",
          403,
        );
      }
      if (account.authProvider !== "credentials" || !account.passwordHash) {
        throw new Error(
          "Ce compte n'utilise pas d'identifiants locaux. Contactez les RH.",
        );
      }

      const valid = await verifyPassword(currentPassword, account.passwordHash);
      if (!valid) {
        throw new Error("Mot de passe actuel incorrect.");
      }

      const passwordHash = await hashPassword(newPassword);
      const updated = await updateUserAccount(account.id, {
        passwordHash,
        mustChangePassword: false,
      });

      return {
        accountId: updated.id,
        mustChangePassword: updated.mustChangePassword,
      };
    },
  };
}

export type PasswordChangeService = ReturnType<
  typeof createPasswordChangeService
>;
