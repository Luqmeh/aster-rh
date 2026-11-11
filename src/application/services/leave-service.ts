import {
  canSubmitLeave,
  countBusinessDays,
  leaveRequestInputSchema,
  usesLeaveBalance,
  type LeaveRequestInput,
} from "@/domain/rules/leave";
import {
  assertCanDecideRequest,
  decisionNotificationCopy,
  initialStatusAfterSubmit,
  nextStatusAfterManagerDecision,
  type Decision,
} from "@/domain/rules/approvals";
import {
  canApproveRequests,
  canViewAllRequests,
} from "@/domain/rules/permissions";
import { mergeHolidaysWithOverrides } from "@/domain/rules/morocco-holidays";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { EmailPort } from "@/infrastructure/email/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

async function excludedHolidayDatesForRange(
  hr: HrRepository,
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const years = [
    ...new Set([Number(startDate.slice(0, 4)), Number(endDate.slice(0, 4))]),
  ];
  const overrides = (
    await Promise.all(years.map((y) => hr.listHolidayOverrides(y)))
  ).flat();
  return mergeHolidaysWithOverrides(years, overrides)
    .map((h) => h.date)
    .filter((d) => d >= startDate && d <= endDate);
}

export function createLeaveService(deps: {
  hr: HrRepository;
  email: EmailPort;
}) {
  const ledger = createLeaveLedgerService({ hr: deps.hr });

  return {
    async listForCurrentUser(session: AuthSession) {
      return deps.hr.listLeaveRequests({ employeeId: session.employee.id });
    },

    /** Demandes visibles selon le rôle (propre / toutes). */
    async listVisible(session: AuthSession) {
      if (canViewAllRequests(session.role)) {
        return deps.hr.listLeaveRequests();
      }
      return deps.hr.listLeaveRequests({ employeeId: session.employee.id });
    },

    /** File d'attente : Chef de projet (décision) et RH (lecture). */
    async listTeamPending(session: AuthSession) {
      if (!canViewAllRequests(session.role)) return [];
      const items = await deps.hr.listLeaveRequests();
      return items.filter(
        (r) =>
          r.status === "en_attente_manager" || r.status === "en_attente_rh",
      );
    },

    async getBalance(session: AuthSession, year = 2026) {
      const [cp, rtt, recovery] = await Promise.all([
        ledger.getBalanceForLeaveType(
          session,
          session.employee.id,
          "conges_payes",
          year,
        ),
        ledger.getBalanceForLeaveType(
          session,
          session.employee.id,
          "rtt",
          year,
        ),
        ledger.getBalanceForLeaveType(
          session,
          session.employee.id,
          "recuperation",
          year,
        ),
      ]);
      return {
        employeeId: session.employee.id,
        year,
        congesPayesAcquis: cp?.totalCredited ?? 0,
        congesPayesPris: cp?.totalConsumed ?? 0,
        /** Disponible après réservations pending (source unique avec approbation). */
        congesPayesRestants: cp?.availableAfterReservations ?? 0,
        rttAcquis: rtt?.totalCredited ?? 0,
        rttPris: rtt?.totalConsumed ?? 0,
        rttRestants: rtt?.availableAfterReservations ?? 0,
        recoveryDaysAcquis: recovery?.totalCredited ?? 0,
        recoveryDaysPris: recovery?.totalConsumed ?? 0,
        recoveryDaysRestants: recovery?.availableAfterReservations ?? 0,
      };
    },

    async submit(session: AuthSession, raw: LeaveRequestInput) {
      if (!canSubmitLeave(session.employee)) {
        throw new Error("Collaborateur inactif — demande impossible.");
      }
      const input = leaveRequestInputSchema.parse(raw);
      const holidays = await excludedHolidayDatesForRange(
        deps.hr,
        input.startDate,
        input.endDate,
      );
      const daysCount = countBusinessDays(
        input.startDate,
        input.endDate,
        input.halfDayStart,
        input.halfDayEnd,
        holidays,
      );
      if (daysCount <= 0) {
        throw new Error("La période sélectionnée ne contient aucun jour ouvré.");
      }

      if (usesLeaveBalance(input.type)) {
        const snap = await ledger.getBalanceForLeaveType(
          session,
          session.employee.id,
          input.type,
          2026,
        );
        if (snap && daysCount > snap.availableAfterReservations) {
          throw new Error(
            `Solde insuffisant : ${snap.availableAfterReservations} jour(s) disponible(s) après réservations, ${daysCount} demandé(s).`,
          );
        }
      }

      const request = await deps.hr.createLeaveRequest({
        employeeId: session.employee.id,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        halfDayStart: input.halfDayStart,
        halfDayEnd: input.halfDayEnd,
        daysCount,
        status: initialStatusAfterSubmit(),
        comment: input.comment ?? null,
        managerComment: null,
      });

      if (session.employee.managerId) {
        const manager = await deps.hr.getEmployee(session.employee.managerId);
        if (manager) {
          await deps.hr.addNotification({
            recipientId: manager.id,
            title: "Demande de congés à valider",
            body: `${session.employee.firstName} ${session.employee.lastName} a soumis une demande.`,
            href: "/conges",
            read: false,
            createdAt: new Date().toISOString(),
          });
          await deps.email.send({
            to: manager.email,
            subject: "[ASTER] Demande de congés à valider",
            body: `Nouvelle demande de ${session.employee.firstName} ${session.employee.lastName}.`,
          });
        }
      }

      return request;
    },

    async decide(
      session: AuthSession,
      requestId: string,
      decision: Decision,
      comment?: string,
    ) {
      if (!canApproveRequests(session.role)) {
        throw new Error(
          session.role === "admin_rh"
            ? "Les ressources humaines peuvent consulter les demandes mais ne peuvent pas les approuver ni les refuser."
            : "Action réservée au Chef de projet.",
        );
      }

      const request = await deps.hr.getLeaveRequest(requestId);
      if (!request) throw new Error("Demande introuvable.");
      const subject = await deps.hr.getEmployee(request.employeeId);
      if (!subject) throw new Error("Collaborateur introuvable.");

      const authz = assertCanDecideRequest({
        role: session.role,
        actor: session.employee,
        subject,
        status: request.status,
      });
      if (!authz.ok) throw new Error(authz.message);

      const status = nextStatusAfterManagerDecision(decision, false);
      const updated = await deps.hr.updateLeaveRequest(requestId, {
        status,
        managerComment: comment ?? null,
      });

      if (status === "approuvee") {
        // Phase 1 : débit ledger à l'approbation (idempotent). Les refus/annulations
        // ne créent pas d'écriture — les réservations pending se libèrent seules.
        await ledger.recordApprovedLeaveConsumption({
          request: updated,
          actorEmployeeId: session.employee.id,
        });
      }

      const copy = decisionNotificationCopy("leave", decision);
      await deps.hr.addNotification({
        recipientId: subject.id,
        title: copy.title,
        body: comment?.trim() || copy.defaultBody,
        href: "/conges",
        read: false,
        createdAt: new Date().toISOString(),
      });

      await deps.email.send({
        to: subject.email,
        subject: `[ASTER] Congés ${decision === "approuvee" ? "approuvés" : "refusés"}`,
        body: `Votre demande ${requestId} est maintenant : ${status}.`,
      });

      return updated;
    },
  };
}

export type LeaveService = ReturnType<typeof createLeaveService>;
