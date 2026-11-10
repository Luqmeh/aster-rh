import { randomBytes } from "crypto";
import {
  canAssignRole,
  canModifyAccountRole,
} from "@/domain/rules/role-assignment";
import {
  assertLifecycleTransition,
  initialsFromName,
  isValidEmployeeEmail,
  isValidEmployeeId,
  normalizeEmployeeEmail,
  syncIsActive,
} from "@/domain/rules/lifecycle";
import {
  canManageLifecycle,
  canProvisionEmployees,
  hasPermission,
} from "@/domain/rules/permissions";
import type {
  ContractType,
  DemoRole,
  EmployeeCategory,
  EmploymentStatus,
} from "@/domain/types/hr";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import {
  createUserAccount,
  findAccountByEmail,
  findAccountByEmployeeId,
  updateUserAccount,
} from "@/infrastructure/auth/account-store";
import { hashPassword } from "@/infrastructure/auth/password";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { EmailPort } from "@/infrastructure/email/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

export type OnboardEmployeeInput = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  departmentId: string;
  managerId: string | null;
  site: string;
  contractType: ContractType;
  category: EmployeeCategory;
  hireDate: string;
  phoneInternal?: string | null;
  teleworkEligible?: boolean;
  provisionAccount?: boolean;
  role?: DemoRole;
  temporaryPassword?: string;
};

function generateTemporaryPassword(): string {
  return `Aster-${randomBytes(9).toString("base64url")}`;
}

export function createEmployeeProvisioningService(deps: {
  hr: HrRepository;
  email: EmailPort;
}) {
  return {
    async onboard(session: AuthSession, raw: OnboardEmployeeInput) {
      requireSession(session);
      if (!canProvisionEmployees(session.role)) {
        throw new AuthError("Provisioning réservé aux rôles autorisés.", 403);
      }

      const id = raw.id.trim();
      const email = normalizeEmployeeEmail(raw.email);
      if (!isValidEmployeeId(id)) {
        throw new Error(
          "Identifiant collaborateur invalide (3–64 caractères alphanumériques).",
        );
      }
      if (!isValidEmployeeEmail(email)) {
        throw new Error("Adresse e-mail professionnelle invalide.");
      }

      const role: DemoRole = raw.role ?? "collaborateur";
      if (!canAssignRole(session.role, role)) {
        throw new AuthError(
          "Vous ne pouvez pas attribuer ce rôle applicatif.",
          403,
        );
      }

      if (await deps.hr.getEmployee(id)) {
        throw new Error("Identifiant collaborateur déjà utilisé.");
      }
      if (await deps.hr.getEmployeeByEmail(email)) {
        throw new Error("Adresse e-mail déjà utilisée par un collaborateur.");
      }
      if (await findAccountByEmail(email)) {
        throw new Error("Un compte applicatif existe déjà pour cet e-mail.");
      }

      if (raw.managerId) {
        const manager = await deps.hr.getEmployee(raw.managerId);
        if (!manager || !manager.isActive) {
          throw new Error("Manager hiérarchique introuvable ou inactif.");
        }
      }

      const employee = await deps.hr.createEmployee({
        id,
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
        email,
        jobTitle: raw.jobTitle.trim(),
        departmentId: raw.departmentId,
        managerId: raw.managerId,
        site: raw.site.trim(),
        contractType: raw.contractType,
        category: raw.category,
        hireDate: raw.hireDate,
        employmentStatus: "actif",
        departureDate: null,
        departureNote: null,
        phoneInternal: raw.phoneInternal?.trim() || null,
        avatarInitials: initialsFromName(raw.firstName, raw.lastName),
        teleworkEligible: raw.teleworkEligible ?? true,
      });

      let temporaryPassword: string | null = null;
      let accountId: string | null = null;
      if (raw.provisionAccount !== false) {
        temporaryPassword =
          raw.temporaryPassword?.trim() || generateTemporaryPassword();
        const passwordHash = await hashPassword(temporaryPassword);
        const account = await createUserAccount({
          email,
          passwordHash,
          authProvider: "credentials",
          role,
          employeeId: employee.id,
          isActive: true,
          mustChangePassword: true,
        });
        accountId = account.id;
        await deps.hr.addRoleChangeAudit({
          targetAccountId: account.id,
          previousRole: role,
          newRole: role,
          actorEmployeeId: session.employee.id,
        });
        await deps.email.send({
          to: email,
          subject: "[ASTER] Compte collaborateur provisionné",
          body: `Bonjour ${employee.firstName},\n\nVotre compte ASTER a été créé.\nIdentifiant : ${email}\nMot de passe temporaire : ${temporaryPassword}\n\nÀ la première connexion, vous devrez obligatoirement changer ce mot de passe temporaire.`,
        });
      }

      return { employee, accountId, temporaryPassword };
    },

    /**
     * Régénère un mot de passe temporaire (affichage unique côté UI RH).
     * Impossible de récupérer l'ancien plaintext — uniquement hashé.
     */
    async reprovisionTemporaryPassword(
      session: AuthSession,
      employeeId: string,
    ) {
      requireSession(session);
      if (!canProvisionEmployees(session.role)) {
        throw new AuthError("Reprovisioning réservé aux rôles autorisés.", 403);
      }

      const employee = await deps.hr.getEmployee(employeeId);
      if (!employee) throw new AuthError("Collaborateur introuvable.", 404);

      const account = await findAccountByEmployeeId(employeeId);
      if (!account) {
        throw new Error("Aucun compte applicatif lié à ce collaborateur.");
      }
      if (account.authProvider !== "credentials") {
        throw new Error(
          "Ce compte n'utilise pas d'identifiants locaux ; le SSO Entra s'applique.",
        );
      }
      if (!account.isActive || !employee.isActive) {
        throw new Error("Compte ou fiche inactive — réactivez avant reprovisionnement.");
      }

      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      await updateUserAccount(account.id, {
        passwordHash,
        mustChangePassword: true,
      });

      await deps.email.send({
        to: account.email,
        subject: "[ASTER] Mot de passe temporaire renouvelé",
        body: `Bonjour ${employee.firstName},\n\nUn nouveau mot de passe temporaire a été généré pour votre compte ASTER.\nIdentifiant : ${account.email}\nMot de passe temporaire : ${temporaryPassword}\n\nVous devrez le changer à la prochaine connexion.`,
      });

      return {
        employeeId: employee.id,
        email: account.email,
        temporaryPassword,
      };
    },

    async changeLifecycle(
      session: AuthSession,
      employeeId: string,
      nextStatus: EmploymentStatus,
      options?: { departureDate?: string; departureNote?: string },
    ) {
      requireSession(session);
      if (!canManageLifecycle(session.role)) {
        throw new AuthError("Cycle de vie réservé aux rôles autorisés.", 403);
      }
      const employee = await deps.hr.getEmployee(employeeId);
      if (!employee) throw new AuthError("Collaborateur introuvable.", 404);

      const transition = assertLifecycleTransition({
        from: employee.employmentStatus,
        to: nextStatus,
      });
      if (!transition.ok) throw new Error(transition.message);

      if (nextStatus === "parti" && !options?.departureDate) {
        throw new Error("La date de départ est obligatoire.");
      }

      const updated = await deps.hr.updateEmployee(employeeId, {
        employmentStatus: nextStatus,
        isActive: syncIsActive(nextStatus),
        departureDate:
          nextStatus === "parti"
            ? options?.departureDate ?? null
            : nextStatus === "actif"
              ? null
              : employee.departureDate,
        departureNote:
          nextStatus === "parti"
            ? options?.departureNote?.trim() || null
            : nextStatus === "actif"
              ? null
              : employee.departureNote,
      });

      const account = await findAccountByEmployeeId(employeeId);
      if (account) {
        await updateUserAccount(account.id, {
          isActive: syncIsActive(nextStatus),
        });
      }

      return updated;
    },

    async changeRole(
      session: AuthSession,
      employeeId: string,
      nextRole: DemoRole,
    ) {
      requireSession(session);
      const account = await findAccountByEmployeeId(employeeId);
      if (!account) {
        throw new Error("Aucun compte applicatif lié à ce collaborateur.");
      }

      const check = canModifyAccountRole(
        session.role,
        account.role,
        nextRole,
      );
      if (!check.ok) throw new AuthError(check.message, 403);

      if (
        account.role === "chef_de_projet" &&
        nextRole !== "chef_de_projet" &&
        account.employeeId === session.employee.id
      ) {
        const chefs = await deps.hr.countAccountsByRole("chef_de_projet");
        if (chefs <= 1) {
          throw new AuthError(
            "Impossible de retirer le dernier accès Chef de projet actif.",
            403,
          );
        }
      }

      if (
        !hasPermission(session.role, "account.role.assign_all") &&
        nextRole !== "collaborateur"
      ) {
        throw new AuthError(
          "Attribution de rôle privilégié réservée au Chef de projet.",
          403,
        );
      }

      const previousRole = account.role;
      const updated = await updateUserAccount(account.id, { role: nextRole });
      await deps.hr.addRoleChangeAudit({
        targetAccountId: account.id,
        previousRole,
        newRole: nextRole,
        actorEmployeeId: session.employee.id,
      });
      return updated;
    },
  };
}

export type EmployeeProvisioningService = ReturnType<
  typeof createEmployeeProvisioningService
>;
