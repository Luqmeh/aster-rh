import {
  assertCanDecideRequest,
  decisionNotificationCopy,
  initialStatusAfterSubmit,
  nextStatusAfterManagerDecision,
  type Decision,
} from "@/domain/rules/approvals";
import { monthBounds } from "@/domain/rules/dates";
import {
  canApproveRequests,
  canSubmitTeleworkRequest,
  canViewAllRequests,
} from "@/domain/rules/permissions";
import {
  assertTeleworkEligibility,
  canModifyTeleworkPlan,
  canWithdrawTeleworkPlan,
  monthlyTeleworkPlanInputSchema,
  validateMonthlyTeleworkPlan,
  type MonthlyTeleworkPlanInput,
} from "@/domain/rules/telework-monthly";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { EmailPort } from "@/infrastructure/email/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

export function createTeleworkService(deps: {
  hr: HrRepository;
  email: EmailPort;
}) {
  return {
    async listForCurrentUser(session: AuthSession) {
      return deps.hr.listTeleworkRequests({ employeeId: session.employee.id });
    },

    async listVisible(session: AuthSession) {
      if (canViewAllRequests(session.role)) {
        return deps.hr.listTeleworkRequests();
      }
      return deps.hr.listTeleworkRequests({ employeeId: session.employee.id });
    },

    async listTeamPending(session: AuthSession) {
      if (!canViewAllRequests(session.role)) return [];
      const items = await deps.hr.listTeleworkRequests();
      return items.filter(
        (r) =>
          r.status === "en_attente_manager" || r.status === "en_attente_rh",
      );
    },

    async getApprovedLeaveForEmployee(employeeId: string) {
      const leaves = await deps.hr.listLeaveRequests({ employeeId });
      return leaves.filter((l) => l.status === "approuvee");
    },

    async submitMonthlyPlan(session: AuthSession, raw: MonthlyTeleworkPlanInput) {
      if (!canSubmitTeleworkRequest(session.role)) {
        throw new Error(
          "Le libre-service télétravail est réservé aux collaborateurs.",
        );
      }
      const eligibility = assertTeleworkEligibility(session.employee);
      if (!eligibility.ok) throw new Error(eligibility.message);

      const input = monthlyTeleworkPlanInputSchema.parse(raw);
      const approvedLeave = (
        await deps.hr.listLeaveRequests({ employeeId: session.employee.id })
      ).filter((l) => l.status === "approuvee");
      const validated = validateMonthlyTeleworkPlan(
        input.month,
        input.days,
        approvedLeave,
      );
      if (!validated.ok) throw new Error(validated.message);

      const existing = await deps.hr.listTeleworkRequests({
        employeeId: session.employee.id,
      });
      const clash = existing.find(
        (r) =>
          r.month === input.month &&
          (r.status === "en_attente_manager" || r.status === "approuvee"),
      );
      if (clash) {
        throw new Error(
          "Un plan est déjà en attente ou approuvé pour ce mois. Retirez-le ou attendez la décision.",
        );
      }

      const { start, end } = monthBounds(input.month);
      const request = await deps.hr.createTeleworkRequest({
        employeeId: session.employee.id,
        type: "regulier",
        month: input.month,
        startDate: start,
        endDate: end,
        days: validated.days,
        status: initialStatusAfterSubmit(),
        reason: input.reason ?? null,
        managerComment: null,
      });

      if (session.employee.managerId) {
        const manager = await deps.hr.getEmployee(session.employee.managerId);
        if (manager) {
          await deps.hr.addNotification({
            recipientId: manager.id,
            title: "Plan de télétravail à valider",
            body: `${session.employee.firstName} ${session.employee.lastName} a soumis un plan pour ${input.month} (${validated.days.length} jour(s)).`,
            href: "/teletravail",
            read: false,
            createdAt: new Date().toISOString(),
          });
          await deps.email.send({
            to: manager.email,
            subject: "[ASTER DÉMO] Plan télétravail mensuel",
            body: `Nouveau plan de ${session.employee.firstName} ${session.employee.lastName} (${input.month}).`,
          });
        }
      }

      return request;
    },

    async updatePendingPlan(
      session: AuthSession,
      requestId: string,
      raw: MonthlyTeleworkPlanInput,
    ) {
      if (!canSubmitTeleworkRequest(session.role)) {
        throw new Error(
          "Le libre-service télétravail est réservé aux collaborateurs.",
        );
      }
      const request = await deps.hr.getTeleworkRequest(requestId);
      if (!request) throw new Error("Plan introuvable.");
      if (request.employeeId !== session.employee.id) {
        throw new Error("Vous ne pouvez modifier que vos propres plans.");
      }
      if (!canModifyTeleworkPlan(request.status)) {
        throw new Error("Seuls les plans en attente peuvent être modifiés.");
      }

      const eligibility = assertTeleworkEligibility(session.employee);
      if (!eligibility.ok) throw new Error(eligibility.message);

      const input = monthlyTeleworkPlanInputSchema.parse(raw);
      if (request.month && request.month !== input.month) {
        throw new Error(
          "Le mois du plan ne peut pas être changé. Créez un nouveau plan.",
        );
      }

      const approvedLeave = (
        await deps.hr.listLeaveRequests({ employeeId: session.employee.id })
      ).filter((l) => l.status === "approuvee");
      const validated = validateMonthlyTeleworkPlan(
        input.month,
        input.days,
        approvedLeave,
      );
      if (!validated.ok) throw new Error(validated.message);

      const { start, end } = monthBounds(input.month);
      return deps.hr.updateTeleworkRequest(requestId, {
        days: validated.days,
        startDate: start,
        endDate: end,
        month: input.month,
        reason: input.reason ?? request.reason,
      });
    },

    async withdrawPendingPlan(session: AuthSession, requestId: string) {
      if (!canSubmitTeleworkRequest(session.role)) {
        throw new Error(
          "Le libre-service télétravail est réservé aux collaborateurs.",
        );
      }
      const request = await deps.hr.getTeleworkRequest(requestId);
      if (!request) throw new Error("Plan introuvable.");
      if (request.employeeId !== session.employee.id) {
        throw new Error("Vous ne pouvez retirer que vos propres plans.");
      }
      if (!canWithdrawTeleworkPlan(request.status)) {
        throw new Error("Seuls les plans en attente peuvent être retirés.");
      }
      return deps.hr.updateTeleworkRequest(requestId, {
        status: "annulee",
      });
    },

    async decide(
      session: AuthSession,
      requestId: string,
      decision: Decision,
      comment?: string,
    ) {
      const request = await deps.hr.getTeleworkRequest(requestId);
      if (!request) throw new Error("Demande introuvable.");
      const subject = await deps.hr.getEmployee(request.employeeId);
      if (!subject) throw new Error("Collaborateur introuvable.");

      if (!canApproveRequests(session.role)) {
        throw new Error(
          session.role === "admin_rh"
            ? "Les ressources humaines peuvent consulter les demandes mais ne peuvent pas les approuver ni les refuser."
            : "Action réservée au Chef de projet.",
        );
      }

      const authz = assertCanDecideRequest({
        role: session.role,
        actor: session.employee,
        subject,
        status: request.status,
      });
      if (!authz.ok) throw new Error(authz.message);

      if (decision === "refusee" && !comment?.trim()) {
        throw new Error("Un motif de refus est obligatoire.");
      }

      const status = nextStatusAfterManagerDecision(decision, false);
      const updated = await deps.hr.updateTeleworkRequest(requestId, {
        status,
        managerComment: comment?.trim() || null,
      });

      const copy = decisionNotificationCopy("telework", decision);
      await deps.hr.addNotification({
        recipientId: subject.id,
        title: copy.title,
        body: comment?.trim() || copy.defaultBody,
        href: "/teletravail",
        read: false,
        createdAt: new Date().toISOString(),
      });

      await deps.email.send({
        to: subject.email,
        subject: `[ASTER] Télétravail ${decision === "approuvee" ? "approuvé" : "refusé"}`,
        body: `Votre plan ${requestId} est maintenant : ${status}.`,
      });

      return updated;
    },
  };
}

export type TeleworkService = ReturnType<typeof createTeleworkService>;
