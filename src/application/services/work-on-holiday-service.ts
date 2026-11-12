import {
  mergeHolidaysWithOverrides,
  requirePublicHoliday,
  type CalendarHoliday,
} from "@/domain/rules/morocco-holidays";
import {
  assertActualHoursReview,
  assertApprovalBeforeHoliday,
  assertCanDeclareActualWork,
  canTransitionWorkOnHoliday,
  hoursToRecoveryDays,
  OPEN_WORK_ON_HOLIDAY_STATUSES,
  resolveStandardDailyHours,
} from "@/domain/rules/work-on-holiday";
import {
  canApproveWorkOnHoliday,
  canManageHolidays,
  canViewAllWorkOnHoliday,
  hasPermission,
} from "@/domain/rules/permissions";
import type {
  HolidayOverride,
  WorkOnHolidayRequest,
  WorkOnHolidayStatus,
} from "@/domain/types/hr";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { EmailPort } from "@/infrastructure/email/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";

async function notifyChefs(
  deps: { hr: HrRepository; email: EmailPort },
  title: string,
  body: string,
  href: string,
) {
  const { findAccountByEmployeeId } = await import(
    "@/infrastructure/auth/account-store"
  );
  const emps = await deps.hr.listEmployees({ employmentStatus: "actif" });
  for (const recipient of emps) {
    const account = await findAccountByEmployeeId(recipient.id);
    if (account?.role !== "chef_de_projet" && recipient.id !== "emp-julien") {
      continue;
    }
    await deps.hr.addNotification({
      recipientId: recipient.id,
      title,
      body,
      href,
      read: false,
      createdAt: new Date().toISOString(),
    });
    await deps.email.send({
      to: recipient.email,
      subject: `[ASTER] ${title}`,
      body,
    });
  }
}

export function createWorkOnHolidayService(deps: {
  hr: HrRepository;
  email: EmailPort;
}) {
  async function loadHolidays(years: number[]): Promise<CalendarHoliday[]> {
    const overrides = (
      await Promise.all(years.map((y) => deps.hr.listHolidayOverrides(y)))
    ).flat();
    return mergeHolidaysWithOverrides(
      years,
      overrides.map((o) => ({
        id: o.id,
        sourceKey: o.sourceKey,
        date: o.date,
        nameFr: o.nameFr,
        kind: o.kind,
        confirmation: o.confirmation,
        isActive: o.isActive,
        year: o.year,
      })),
    );
  }

  return {
    async listHolidays(years?: number[]) {
      const y =
        years ??
        [2025, 2026, 2027, 2028].filter(
          (year) => year >= new Date().getUTCFullYear() - 1,
        );
      return loadHolidays(y);
    },

    async upsertHolidayOverride(
      session: AuthSession,
      input: Omit<
        HolidayOverride,
        "id" | "createdAt" | "updatedAt" | "createdByEmployeeId"
      > & { id?: string },
    ) {
      requireSession(session);
      if (!canManageHolidays(session.role)) {
        throw new AuthError("Gestion des jours fériés réservée aux RH / Chef.", 403);
      }
      return deps.hr.upsertHolidayOverride({
        ...input,
        createdByEmployeeId: session.employee.id,
      });
    },

    async submit(
      session: AuthSession,
      input: {
        holidayDate: string;
        plannedHours: number;
        plannedStart?: string | null;
        plannedEnd?: string | null;
        reason: string;
      },
    ) {
      requireSession(session);
      if (!hasPermission(session.role, "work_on_holiday.submit")) {
        throw new AuthError("Soumission refusée.", 403);
      }
      if (!session.employee.isActive) {
        throw new AuthError("Compte inactif.", 403);
      }
      const year = Number(input.holidayDate.slice(0, 4));
      const holidays = await loadHolidays([year]);
      const holiday = requirePublicHoliday(input.holidayDate, holidays);

      const approvalGate = assertApprovalBeforeHoliday(input.holidayDate);
      if (!approvalGate.ok) throw new Error(approvalGate.message);

      if (input.plannedHours <= 0 || input.plannedHours > 24) {
        throw new Error("Indiquez une durée planifiée entre 0 et 24 heures.");
      }
      const reason = input.reason.trim();
      if (reason.length < 5) {
        throw new Error("Justifiez la demande (5 caractères min.).");
      }

      const existing = await deps.hr.listWorkOnHolidayRequests({
        employeeId: session.employee.id,
        holidayDate: input.holidayDate,
      });
      if (existing.some((r) => OPEN_WORK_ON_HOLIDAY_STATUSES.has(r.status))) {
        throw new Error(
          "Une demande active existe déjà pour ce jour férié.",
        );
      }

      const created = await deps.hr.createWorkOnHolidayRequest({
        employeeId: session.employee.id,
        holidayDate: holiday.date,
        holidaySourceKey: holiday.sourceKey,
        holidayName: holiday.nameFr,
        plannedHours: input.plannedHours,
        plannedStart: input.plannedStart?.trim() || null,
        plannedEnd: input.plannedEnd?.trim() || null,
        reason,
        status: "en_attente",
        decidedByEmployeeId: null,
        decisionComment: null,
        decidedAt: null,
        actualHours: null,
        actualDeclaredAt: null,
        confirmedHours: null,
        confirmedByEmployeeId: null,
        confirmedAt: null,
        creditLedgerId: null,
      });

      await notifyChefs(
        deps,
        "Travail un jour férié à valider",
        `${session.employee.firstName} ${session.employee.lastName} souhaite travailler le ${holiday.date} (${holiday.nameFr}).`,
        "/calendrier",
      );
      return created;
    },

    async listVisible(
      session: AuthSession,
      filter?: { status?: WorkOnHolidayStatus | WorkOnHolidayStatus[] },
    ) {
      requireSession(session);
      if (canViewAllWorkOnHoliday(session.role)) {
        return deps.hr.listWorkOnHolidayRequests(filter);
      }
      if (!hasPermission(session.role, "work_on_holiday.view_own")) {
        throw new AuthError("Accès refusé.", 403);
      }
      return deps.hr.listWorkOnHolidayRequests({
        employeeId: session.employee.id,
        status: filter?.status,
      });
    },

    async getVisible(session: AuthSession, id: string) {
      requireSession(session);
      const row = await deps.hr.getWorkOnHolidayRequest(id);
      if (!row) throw new AuthError("Demande introuvable.", 404);
      if (canViewAllWorkOnHoliday(session.role)) return row;
      if (row.employeeId !== session.employee.id) {
        throw new AuthError("Accès à cette demande refusé.", 403);
      }
      return row;
    },

    async decide(
      session: AuthSession,
      id: string,
      decision: "approuvee" | "refusee",
      comment?: string,
    ) {
      requireSession(session);
      if (!canApproveWorkOnHoliday(session.role)) {
        throw new AuthError(
          "Seuls les Chefs de projet peuvent approuver ou refuser.",
          403,
        );
      }
      const existing = await deps.hr.getWorkOnHolidayRequest(id);
      if (!existing) throw new AuthError("Demande introuvable.", 404);
      if (!canTransitionWorkOnHoliday(existing.status, decision)) {
        throw new Error("Transition de statut impossible.");
      }
      if (decision === "approuvee") {
        const gate = assertApprovalBeforeHoliday(existing.holidayDate);
        if (!gate.ok) throw new Error(gate.message);
      }
      if (decision === "refusee" && !(comment?.trim())) {
        throw new Error("Le motif de refus est obligatoire.");
      }

      const updated = await deps.hr.updateWorkOnHolidayRequest(id, {
        status: decision,
        decidedByEmployeeId: session.employee.id,
        decisionComment: comment?.trim() || null,
        decidedAt: new Date().toISOString(),
      });

      await deps.hr.addNotification({
        recipientId: existing.employeeId,
        title:
          decision === "approuvee"
            ? "Travail un jour férié approuvé"
            : "Travail un jour férié refusé",
        body:
          decision === "approuvee"
            ? `Votre demande pour le ${existing.holidayDate} a été approuvée.`
            : `Votre demande pour le ${existing.holidayDate} a été refusée : ${comment?.trim()}`,
        href: "/calendrier",
        read: false,
        createdAt: new Date().toISOString(),
      });
      return updated;
    },

    async declareActualHours(
      session: AuthSession,
      id: string,
      actualHours: number,
    ) {
      requireSession(session);
      if (!hasPermission(session.role, "work_on_holiday.submit")) {
        throw new AuthError(
          "La déclaration d'heures férié est réservée aux collaborateurs.",
          403,
        );
      }
      const existing = await deps.hr.getWorkOnHolidayRequest(id);
      if (!existing) throw new AuthError("Demande introuvable.", 404);
      if (existing.employeeId !== session.employee.id) {
        throw new AuthError("Vous ne pouvez déclarer que vos propres heures.", 403);
      }
      const gate = assertCanDeclareActualWork(
        existing.holidayDate,
        existing.status,
      );
      if (!gate.ok) throw new Error(gate.message);
      const review = assertActualHoursReview(
        existing.plannedHours,
        actualHours,
      );
      if (!review.ok) throw new Error(review.message);

      const updated = await deps.hr.updateWorkOnHolidayRequest(id, {
        status: "travail_effectue_a_confirmer",
        actualHours,
        actualDeclaredAt: new Date().toISOString(),
      });

      await notifyChefs(
        deps,
        "Heures férié à confirmer",
        `${session.employee.firstName} ${session.employee.lastName} a déclaré ${actualHours} h le ${existing.holidayDate}${
          review.needsExplicitReview
            ? " (supérieur au planifié — revue requise)"
            : ""
        }.`,
        "/calendrier",
      );
      return updated;
    },

    async confirmAndCredit(
      session: AuthSession,
      id: string,
      confirmedHours: number,
    ) {
      requireSession(session);
      if (!canApproveWorkOnHoliday(session.role)) {
        throw new AuthError(
          "Confirmation réservée au Chef de projet.",
          403,
        );
      }
      const existing = await deps.hr.getWorkOnHolidayRequest(id);
      if (!existing) throw new AuthError("Demande introuvable.", 404);
      if (existing.creditLedgerId) {
        throw new Error("Crédit déjà appliqué pour cette demande.");
      }
      const dup = await deps.hr.getRecoveryCreditBySourceRequest(existing.id);
      if (dup) {
        throw new Error("Une écriture ledger existe déjà pour cette demande.");
      }
      if (
        !canTransitionWorkOnHoliday(
          existing.status,
          "confirmee_credit_appliquee",
        )
      ) {
        throw new Error("Confirmation impossible dans cet état.");
      }

      const review = assertActualHoursReview(
        existing.plannedHours,
        confirmedHours,
      );
      if (!review.ok) throw new Error(review.message);

      const employee = await deps.hr.getEmployee(existing.employeeId);
      if (!employee) throw new AuthError("Collaborateur introuvable.", 404);
      const daily = resolveStandardDailyHours(employee);
      const daysCredited = hoursToRecoveryDays(confirmedHours, daily);
      const year = Number(existing.holidayDate.slice(0, 4));

      const recoveryLedger = await deps.hr.createRecoveryCredit({
        employeeId: existing.employeeId,
        year,
        sourceKind: "work_on_holiday",
        sourceRequestId: existing.id,
        hoursConfirmed: confirmedHours,
        daysCredited,
        dailyHoursUsed: daily,
        actorEmployeeId: session.employee.id,
      });

      const leaveLedger = createLeaveLedgerService({ hr: deps.hr });
      await leaveLedger.recordRecoveryCredit({
        employeeId: existing.employeeId,
        year,
        daysCredited,
        hoursConfirmed: confirmedHours,
        sourceRequestId: existing.id,
        actorEmployeeId: session.employee.id,
        effectiveDate: existing.holidayDate,
      });

      const updated = await deps.hr.updateWorkOnHolidayRequest(id, {
        status: "confirmee_credit_appliquee",
        confirmedHours,
        confirmedByEmployeeId: session.employee.id,
        confirmedAt: new Date().toISOString(),
        creditLedgerId: recoveryLedger.id,
      });

      await deps.hr.addNotification({
        recipientId: existing.employeeId,
        title: "Récupération créditée",
        body: `${confirmedHours} h confirmées → +${daysCredited} j de récupération (règle produit ASTER 1 h = 1 h).`,
        href: "/conges",
        read: false,
        createdAt: new Date().toISOString(),
      });
      return updated;
    },

    async listRecoveryCredits(session: AuthSession, employeeId?: string) {
      requireSession(session);
      const target = employeeId ?? session.employee.id;
      if (
        target !== session.employee.id &&
        !canViewAllWorkOnHoliday(session.role)
      ) {
        throw new AuthError(
          "Consultation des crédits d'autrui refusée.",
          403,
        );
      }
      return deps.hr.listRecoveryCredits(target);
    },
  };
}

export type { WorkOnHolidayRequest };
