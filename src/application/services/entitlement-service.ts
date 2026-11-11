import {
  assertCarryoverWithinPolicy,
  buildMonthlyPeriod,
  isAlternant,
  isCpEligible,
  isRttEligible,
  previewMonthlyCpAccrual,
  previewMonthlyRttAccrual,
  rttUsageTargetDays,
} from "@/domain/rules/entitlement-accrual";
import {
  CP_CARRYOVER_MAX_DAYS,
  RTT_NON_CADRE_ANNUAL_DAYS,
  seedEntitlementPolicyVersions,
  selectPolicyVersionsForDate,
} from "@/domain/rules/entitlement-policies";
import { SPECIAL_LEAVE_ENTITLEMENTS } from "@/domain/rules/special-leave-entitlements";
import { canAccessHrAdministration } from "@/domain/rules/permissions";
import type {
  AccrualBatch,
  AccrualPreviewLine,
  CarryoverRequest,
  EmployeeEntitlementEligibility,
  OfficeWorkCalendar,
} from "@/domain/types/entitlement";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import type { LeaveLedgerService } from "@/application/services/leave-ledger-service";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Store mémoire process-local pour lots / reports / calendriers (démo + filet offline). */
type EntitlementMemory = {
  batches: AccrualBatch[];
  carryovers: CarryoverRequest[];
  calendars: OfficeWorkCalendar[];
  /** idempotencyKey → ledger entry id déjà posté */
  postedKeys: Map<string, string>;
};

declare global {
  var __asterEntitlementMemory: EntitlementMemory | undefined;
}

function memory(): EntitlementMemory {
  if (!globalThis.__asterEntitlementMemory) {
    globalThis.__asterEntitlementMemory = {
      batches: [],
      carryovers: [],
      calendars: [],
      postedKeys: new Map(),
    };
  }
  return globalThis.__asterEntitlementMemory;
}

export function createEntitlementService(deps: {
  hr: HrRepository;
  leaveLedger: LeaveLedgerService;
}) {
  const policies = seedEntitlementPolicyVersions();

  return {
    listPolicyVersions() {
      return policies;
    },

    listSpecialLeavePolicies() {
      return SPECIAL_LEAVE_ENTITLEMENTS;
    },

    listOfficeCalendars(): OfficeWorkCalendar[] {
      return memory().calendars;
    },

    upsertOfficeCalendar(
      session: AuthSession,
      input: Omit<OfficeWorkCalendar, "id"> & { id?: string },
    ): OfficeWorkCalendar {
      requireSession(session);
      assertHrAdmin(session);
      const mem = memory();
      if (input.id) {
        const idx = mem.calendars.findIndex((c) => c.id === input.id);
        if (idx >= 0) {
          mem.calendars[idx] = { ...mem.calendars[idx], ...input, id: input.id };
          return mem.calendars[idx];
        }
      }
      const row: OfficeWorkCalendar = {
        id: input.id ?? newId("owc"),
        code: input.code,
        label: input.label,
        siteKey: input.siteKey,
        workingHolidays: input.workingHolidays,
        validationStatus: input.validationStatus,
        notes: input.notes,
      };
      mem.calendars.push(row);
      return row;
    },

    async getEmployeeEligibility(
      session: AuthSession,
      employeeId: string,
      asOfDate = "2026-11-10",
    ): Promise<EmployeeEntitlementEligibility> {
      requireSession(session);
      assertCanViewEntitlement(session, employeeId);
      const employee = await deps.hr.getEmployee(employeeId);
      if (!employee) throw new AuthError("Collaborateur introuvable.", 404);

      const applicable = selectPolicyVersionsForDate(policies, asOfDate);
      const warnings: string[] = [];
      const statuses: EmployeeEntitlementEligibility["calculationStatuses"] = [];

      if (!employee.hireDate) {
        statuses.push("missing_employment_information");
        warnings.push("Date d'embauche manquante.");
      }
      if (employee.isPartTime) {
        statuses.push("requires_hr_validation");
        warnings.push("Temps partiel — validation RH pour le calcul CP.");
      }
      if (
        employee.weeklyContractHours != null &&
        employee.weeklyContractHours !== 44
      ) {
        statuses.push("requires_hr_validation");
        warnings.push(
          `Horaires ${employee.weeklyContractHours} h/sem ≠ référence 44 h — À valider par RH.`,
        );
      }
      if (!employee.policyGroup) {
        statuses.push("missing_employment_information");
        warnings.push("Groupe de politique (policyGroup) non renseigné.");
      }
      statuses.push("requires_hr_validation");
      warnings.push(
        "Politiques d’acquisition Maroc : validation RH requise avant posting automatique.",
      );

      return {
        employeeId,
        cpEligible: isCpEligible(employee),
        rttEligible: false,
        isCadre: false,
        isPartTime: employee.isPartTime,
        isAlternant: isAlternant(employee),
        calculationStatuses: [...new Set(statuses)],
        warnings,
        applicablePolicies: applicable.filter((p) => {
          if (p.jurisdiction === "FR" || !p.isActive) return false;
          if (p.kind === "conges_payes") return isCpEligible(employee);
          if (p.kind === "rtt") return false;
          return true;
        }),
      };
    },

    async previewMonthlyAccruals(
      session: AuthSession,
      input: { year: number; month: number; employeeIds?: string[] },
    ): Promise<{
      periodKey: string;
      lines: AccrualPreviewLine[];
      postableCount: number;
      blockedCount: number;
    }> {
      requireSession(session);
      assertHrAdmin(session);
      const period = buildMonthlyPeriod(input.year, input.month);
      const employees = await deps.hr.listEmployees({ includeInactive: true });
      const selected = input.employeeIds?.length
        ? employees.filter((e) => input.employeeIds!.includes(e.id))
        : employees.filter((e) => e.employmentStatus === "actif");

      const lines: AccrualPreviewLine[] = [];
      for (const employee of selected) {
        const cal = employee.officeCalendarId
          ? memory().calendars.find((c) => c.id === employee.officeCalendarId) ??
            null
          : null;
        const cp = previewMonthlyCpAccrual({
          employee,
          period,
          policies,
        });
        if (cp) lines.push(cp);
        const rtt = previewMonthlyRttAccrual({
          employee,
          period,
          policies,
          officeCalendar: cal,
        });
        if (rtt) lines.push(rtt);
      }

      const postableCount = lines.filter(
        (l) => l.calculationStatus === "calculated" && l.quantity > 0,
      ).length;
      const blockedCount = lines.length - postableCount;
      return { periodKey: period.periodKey, lines, postableCount, blockedCount };
    },

    async createPreviewBatch(
      session: AuthSession,
      input: { year: number; month: number; notes?: string },
    ): Promise<AccrualBatch> {
      const preview = await this.previewMonthlyAccruals(session, input);
      const batch: AccrualBatch = {
        id: newId("accb"),
        periodKey: preview.periodKey,
        label: `Acquisition ${preview.periodKey}`,
        status: "preview",
        createdByEmployeeId: session.employee.id,
        postedByEmployeeId: null,
        createdAt: new Date().toISOString(),
        postedAt: null,
        notes: input.notes ?? null,
        lines: preview.lines.map((l) => ({
          id: newId("accl"),
          batchId: "",
          employeeId: l.employeeId,
          account: l.account,
          policyVersionId: l.policyVersionId,
          periodKey: l.periodKey,
          quantity: l.quantity,
          calculationStatus: l.calculationStatus,
          explanation: l.explanation,
          warnings: l.warnings,
          idempotencyKey: l.idempotencyKey,
          ledgerEntryId: null,
          postedAt: null,
          createdAt: new Date().toISOString(),
        })),
      };
      batch.lines = batch.lines.map((l) => ({ ...l, batchId: batch.id }));
      memory().batches.unshift(batch);
      return batch;
    },

    listBatches(session: AuthSession): AccrualBatch[] {
      requireSession(session);
      assertHrAdmin(session);
      return memory().batches;
    },

    getBatch(session: AuthSession, batchId: string): AccrualBatch | null {
      requireSession(session);
      assertHrAdmin(session);
      return memory().batches.find((b) => b.id === batchId) ?? null;
    },

    /**
     * Poste uniquement les lignes `calculated` avec quantité > 0.
     * Idempotent via clé + ledger (sourceKind=entitlement_accrual).
     */
    async postBatch(
      session: AuthSession,
      batchId: string,
    ): Promise<{ posted: number; skipped: number; batch: AccrualBatch }> {
      requireSession(session);
      assertHrAdmin(session);
      const mem = memory();
      const batch = mem.batches.find((b) => b.id === batchId);
      if (!batch) throw new AuthError("Lot d'acquisition introuvable.", 404);
      if (batch.status === "posted") {
        return { posted: 0, skipped: batch.lines.length, batch };
      }

      let posted = 0;
      let skipped = 0;
      const effectiveDate = `${batch.periodKey}-01`;

      for (const line of batch.lines) {
        if (line.calculationStatus !== "calculated" || line.quantity <= 0) {
          skipped += 1;
          continue;
        }
        if (mem.postedKeys.has(line.idempotencyKey) || line.ledgerEntryId) {
          skipped += 1;
          continue;
        }

        const year = Number(batch.periodKey.slice(0, 4));
        const { entry, created } = await deps.hr.appendLeaveLedgerEntry({
          employeeId: line.employeeId,
          account: line.account,
          transactionType: "accrual",
          quantity: line.quantity,
          unit: "days",
          year,
          effectiveDate,
          sourceKind: "entitlement_accrual",
          sourceId: line.idempotencyKey,
          reason: line.explanation,
          actorEmployeeId: session.employee.id,
          metadataJson: {
            policyVersionId: line.policyVersionId,
            periodKey: line.periodKey,
            batchId: batch.id,
            calculationStatus: line.calculationStatus,
            warnings: line.warnings,
          },
        });
        line.ledgerEntryId = entry.id;
        line.postedAt = new Date().toISOString();
        mem.postedKeys.set(line.idempotencyKey, entry.id);
        if (created) posted += 1;
        else skipped += 1;

        await deps.leaveLedger.materializeLeaveBalanceProjection(
          line.employeeId,
          year,
        );
      }

      batch.status = "posted";
      batch.postedAt = new Date().toISOString();
      batch.postedByEmployeeId = session.employee.id;
      return { posted, skipped, batch };
    },

    /**
     * Expire les RTT restants positifs au 1er juillet (écriture expiry).
     * Preview-only si dryRun ; sinon posting contrôlé.
     */
    async previewOrPostRttExpiry(
      session: AuthSession,
      input: { asOfDate: string; dryRun: boolean; employeeIds?: string[] },
    ): Promise<{
      lines: Array<{
        employeeId: string;
        quantity: number;
        explanation: string;
        idempotencyKey: string;
      }>;
      posted: number;
    }> {
      requireSession(session);
      assertHrAdmin(session);
      if (!input.asOfDate.endsWith("-07-01")) {
        throw new Error(
          "L'expiry RTT guide est au 1er juillet — date d'effet attendue …-07-01.",
        );
      }
      const year = Number(input.asOfDate.slice(0, 4));
      const employees = await deps.hr.listEmployees({ includeInactive: true });
      const selected = input.employeeIds?.length
        ? employees.filter((e) => input.employeeIds!.includes(e.id))
        : employees;

      const lines: Array<{
        employeeId: string;
        quantity: number;
        explanation: string;
        idempotencyKey: string;
      }> = [];
      let posted = 0;

      for (const employee of selected) {
        if (!isRttEligible(employee)) continue;
        const snap = await deps.leaveLedger.getAccountBalance(session, {
          employeeId: employee.id,
          account: "rtt",
          year: year - 1,
        });
        // Aussi année courante si solde positif sur année asOf
        const snapCur = await deps.leaveLedger.getAccountBalance(session, {
          employeeId: employee.id,
          account: "rtt",
          year,
        });
        const balance = snap.ledgerBalance + snapCur.ledgerBalance;
        if (balance <= 0) continue;
        const idempotencyKey = `expiry:rtt:${employee.id}:${input.asOfDate}`;
        lines.push({
          employeeId: employee.id,
          quantity: -balance,
          explanation: `Expiry RTT au 1er juillet (pas de report) — ${balance} j.`,
          idempotencyKey,
        });
        if (!input.dryRun) {
          const { created } = await deps.hr.appendLeaveLedgerEntry({
            employeeId: employee.id,
            account: "rtt",
            transactionType: "expiry",
            quantity: -balance,
            unit: "days",
            year,
            effectiveDate: input.asOfDate,
            sourceKind: "entitlement_expiry",
            sourceId: idempotencyKey,
            reason: `Perte RTT non pris au 1er juillet (guide p.38–48).`,
            actorEmployeeId: session.employee.id,
            metadataJson: { sourcePeriod: `RTT before ${input.asOfDate}` },
          });
          if (created) {
            posted += 1;
            await deps.leaveLedger.materializeLeaveBalanceProjection(
              employee.id,
              year,
            );
          }
        }
      }
      return { lines, posted };
    },

    async requestCpCarryover(
      session: AuthSession,
      input: {
        employeeId: string;
        sourcePeriodKey: string;
        targetPeriodKey: string;
        requestedDays: number;
        exceptionReason?: string;
        leavePlanThrough?: string;
        partnerApprovedById?: string;
      },
    ): Promise<CarryoverRequest> {
      requireSession(session);
      assertHrAdmin(session);
      const check = assertCarryoverWithinPolicy({
        requestedDays: input.requestedDays,
        maxDays: CP_CARRYOVER_MAX_DAYS,
        hasPartnerApproval: Boolean(input.partnerApprovedById),
        hasLeavePlanThroughDec31: Boolean(
          input.leavePlanThrough?.endsWith("-12-31"),
        ),
      });
      if (!check.ok && check.requiresException) {
        // On enregistre en attente — jamais d'auto-approbation ni posting.
        const row: CarryoverRequest = {
          id: newId("cvr"),
          employeeId: input.employeeId,
          sourcePeriodKey: input.sourcePeriodKey,
          targetPeriodKey: input.targetPeriodKey,
          requestedDays: input.requestedDays,
          status: "en_attente_validation",
          exceptionReason: input.exceptionReason ?? check.reason,
          leavePlanThrough: input.leavePlanThrough ?? null,
          partnerApprovedById: input.partnerApprovedById ?? null,
          partnerApprovedAt: null,
          rrhForwardedAt: null,
          decidedByEmployeeId: null,
          decidedAt: null,
          decisionNote: null,
          ledgerCarryoverEntryId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        memory().carryovers.unshift(row);
        return row;
      }
      if (!check.ok) {
        throw new Error(check.reason);
      }

      const row: CarryoverRequest = {
        id: newId("cvr"),
        employeeId: input.employeeId,
        sourcePeriodKey: input.sourcePeriodKey,
        targetPeriodKey: input.targetPeriodKey,
        requestedDays: input.requestedDays,
        status: "en_attente_validation",
        exceptionReason: input.exceptionReason ?? null,
        leavePlanThrough: input.leavePlanThrough ?? null,
        partnerApprovedById: input.partnerApprovedById ?? null,
        partnerApprovedAt: input.partnerApprovedById
          ? new Date().toISOString()
          : null,
        rrhForwardedAt: null,
        decidedByEmployeeId: null,
        decidedAt: null,
        decisionNote: null,
        ledgerCarryoverEntryId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memory().carryovers.unshift(row);
      return row;
    },

    async decideCarryover(
      session: AuthSession,
      input: {
        requestId: string;
        approve: boolean;
        decisionNote: string;
      },
    ): Promise<CarryoverRequest> {
      requireSession(session);
      assertHrAdmin(session);
      const note = input.decisionNote.trim();
      if (note.length < 5) {
        throw new Error("Motif de décision obligatoire (5 caractères min.).");
      }
      const row = memory().carryovers.find((c) => c.id === input.requestId);
      if (!row) throw new AuthError("Demande de report introuvable.", 404);

      const check = assertCarryoverWithinPolicy({
        requestedDays: row.requestedDays,
        maxDays: CP_CARRYOVER_MAX_DAYS,
        hasPartnerApproval: Boolean(row.partnerApprovedById),
        hasLeavePlanThroughDec31: Boolean(
          row.leavePlanThrough?.endsWith("-12-31"),
        ),
      });

      if (input.approve && !check.ok) {
        throw new Error(check.reason);
      }

      row.decidedByEmployeeId = session.employee.id;
      row.decidedAt = new Date().toISOString();
      row.decisionNote = note;
      row.updatedAt = row.decidedAt;

      if (!input.approve) {
        row.status = "refusee";
        return row;
      }

      // Posting ledger : débit période source (expiry/consommation report) + crédit acquis cible.
      const idempotencyKey = `carryover:cp:${row.employeeId}:${row.sourcePeriodKey}:${row.targetPeriodKey}`;
      const year = Number(row.targetPeriodKey.slice(0, 4)) || 2026;
      const effectiveDate = `${year}-06-01`;

      // Débit sur acquis source (traçabilité période)
      await deps.hr.appendLeaveLedgerEntry({
        employeeId: row.employeeId,
        account: "conges_payes_acquis",
        transactionType: "expiry",
        quantity: -row.requestedDays,
        unit: "days",
        year: year - 1,
        effectiveDate,
        sourceKind: "entitlement_carryover_out",
        sourceId: idempotencyKey,
        reason: `Report CP sortant (${row.sourcePeriodKey}) — ${row.requestedDays} j.`,
        actorEmployeeId: session.employee.id,
        metadataJson: {
          carryoverRequestId: row.id,
          sourcePeriodKey: row.sourcePeriodKey,
          targetPeriodKey: row.targetPeriodKey,
        },
      });

      const { entry } = await deps.hr.appendLeaveLedgerEntry({
        employeeId: row.employeeId,
        account: "conges_payes_acquis",
        transactionType: "carryover",
        quantity: row.requestedDays,
        unit: "days",
        year,
        effectiveDate,
        sourceKind: "entitlement_carryover_in",
        sourceId: idempotencyKey,
        reason: `Report CP entrant (${row.targetPeriodKey}) depuis ${row.sourcePeriodKey}.`,
        actorEmployeeId: session.employee.id,
        metadataJson: {
          carryoverRequestId: row.id,
          sourcePeriodKey: row.sourcePeriodKey,
          nonCumulative: true,
          maxDays: CP_CARRYOVER_MAX_DAYS,
        },
      });

      row.status = "approuvee";
      row.ledgerCarryoverEntryId = entry.id;
      await deps.leaveLedger.materializeLeaveBalanceProjection(
        row.employeeId,
        year,
      );
      return row;
    },

    listCarryovers(session: AuthSession): CarryoverRequest[] {
      requireSession(session);
      assertHrAdmin(session);
      return memory().carryovers;
    },

    rttUsageTargets(projectedAnnual = RTT_NON_CADRE_ANNUAL_DAYS) {
      return [
        {
          label: "70 % au 31/01",
          days: rttUsageTargetDays(projectedAnnual, 70),
        },
        {
          label: "100 % au 30/06",
          days: rttUsageTargetDays(projectedAnnual, 100),
        },
      ];
    },

    employeesRequiringValidation(session: AuthSession) {
      requireSession(session);
      assertHrAdmin(session);
      return this.previewMonthlyAccruals(session, {
        year: 2026,
        month: 11,
      }).then((p) =>
        p.lines.filter((l) => l.calculationStatus !== "calculated" && l.calculationStatus !== "ineligible"),
      );
    },
  };
}

function assertHrAdmin(session: AuthSession): void {
  if (!canAccessHrAdministration(session.role)) {
    throw new AuthError(
      "Administration des droits à congés réservée RH / Chef de projet.",
      403,
    );
  }
}

function assertCanViewEntitlement(
  session: AuthSession,
  employeeId: string,
): void {
  if (session.employee.id === employeeId) return;
  assertHrAdmin(session);
}

export type EntitlementService = ReturnType<typeof createEntitlementService>;

/** Reset mémoire (tests). */
export function resetEntitlementMemoryForTests(): void {
  globalThis.__asterEntitlementMemory = undefined;
}
