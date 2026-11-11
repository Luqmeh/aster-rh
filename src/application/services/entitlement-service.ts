import {
  buildMonthlyPeriod,
  isAlternant,
  isCpEligible,
  isRttEligible,
  previewMonthlyCpAccrual,
  previewMonthlyRttAccrual,
  rttUsageTargetDays,
} from "@/domain/rules/entitlement-accrual";
import {
  RTT_NON_CADRE_ANNUAL_DAYS,
  seedEntitlementPolicyVersions,
  selectPolicyVersionsForDate,
} from "@/domain/rules/entitlement-policies";
import {
  assertMaCarryoverAgreement,
  computeMoroccoAnnualLeaveAccrual,
  continuousServiceMonths,
  MA_CONTINUOUS_SERVICE_MONTHS_BEFORE_ENTITLEMENT,
} from "@/domain/rules/morocco-annual-leave";
import { listCuratedMoroccoHolidays } from "@/data/morocco-holidays";
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
        warnings.push(
          "Temps partiel — heures de période requises (art. 238-2) pour posting auto.",
        );
      }
      if (!employee.birthDate) {
        warnings.push(
          "birthDate manquant — régime adulte art. 231 par défaut.",
        );
      }
      if (!employee.policyGroup) {
        warnings.push("Groupe de politique (policyGroup) non renseigné.");
      }
      const serviceMonths = continuousServiceMonths(
        employee.hireDate,
        asOfDate,
        employee.departureDate,
      );
      if (serviceMonths < MA_CONTINUOUS_SERVICE_MONTHS_BEFORE_ENTITLEMENT) {
        statuses.push("requires_hr_validation");
        warnings.push(
          `Art. 231 : ${serviceMonths}/${MA_CONTINUOUS_SERVICE_MONTHS_BEFORE_ENTITLEMENT} mois de service continu — droit non encore ouvert.`,
        );
      }
      const sample = computeMoroccoAnnualLeaveAccrual({
        employee,
        asOfDate,
        periodStart: asOfDate.slice(0, 8) + "01",
        periodEnd: asOfDate,
        publicHolidayDates: [],
        rateMode: "company",
      });
      statuses.push(sample.calculationStatus);
      warnings.push(...sample.warnings);

      return {
        employeeId,
        cpEligible: isCpEligible(employee),
        rttEligible: false,
        isCadre: false,
        isPartTime: employee.isPartTime,
        isAlternant: isAlternant(employee),
        calculationStatuses: [...new Set(statuses)],
        warnings: [...new Set(warnings)],
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

      const holidays = listCuratedMoroccoHolidays([input.year])
        .filter(
          (h) => h.date >= period.monthStart && h.date <= period.monthEnd,
        )
        .map((h) => h.date);

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
          publicHolidayDates: holidays,
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
          policyCode: l.policyCode,
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
        /** Accord mutuel salarié–employeur (art. 240). */
        hasMutualAgreement?: boolean;
      },
    ): Promise<CarryoverRequest> {
      requireSession(session);
      assertHrAdmin(session);
      if (input.requestedDays <= 0) {
        throw new Error("Quantité de report invalide.");
      }
      const check = assertMaCarryoverAgreement({
        hasMutualAgreement: Boolean(input.hasMutualAgreement),
        spansAtMostTwoConsecutiveYears: (() => {
          const a = input.sourcePeriodKey.match(/(\d{4})/);
          const b = input.targetPeriodKey.match(/(\d{4})/);
          if (!a || !b) return false;
          const diff = Math.abs(Number(b[1]) - Number(a[1]));
          return diff === 1;
        })(),
      });
      if (!check.ok) {
        throw new Error(check.reason);
      }
      // Toujours enregistré en attente — jamais d'auto-approbation / posting.
      const row: CarryoverRequest = {
        id: newId("cvr"),
        employeeId: input.employeeId,
        sourcePeriodKey: input.sourcePeriodKey,
        targetPeriodKey: input.targetPeriodKey,
        requestedDays: input.requestedDays,
        status: "en_attente_validation",
        exceptionReason:
          input.exceptionReason?.trim() ||
          "Art. 240 — accord mutuel déclaré ; validation RH avant posting ledger.",
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

      const check = assertMaCarryoverAgreement({
        hasMutualAgreement:
          Boolean(row.partnerApprovedById) ||
          Boolean(row.exceptionReason?.trim()) ||
          note.toLowerCase().includes("accord"),
        spansAtMostTwoConsecutiveYears: true,
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

      // Art. 240 : transfert par accord — pas une expiry/forfaiture statutaire.
      const idempotencyKey = `carryover:ma:${row.employeeId}:${row.sourcePeriodKey}:${row.targetPeriodKey}`;
      const yearMatch = row.targetPeriodKey.match(/(\d{4})/);
      const year = yearMatch ? Number(yearMatch[1]) : 2026;
      const sourceYearMatch = row.sourcePeriodKey.match(/(\d{4})/);
      const sourceYear = sourceYearMatch
        ? Number(sourceYearMatch[1])
        : year - 1;
      const effectiveDate = `${year}-01-01`;

      await deps.hr.appendLeaveLedgerEntry({
        employeeId: row.employeeId,
        account: "conges_payes_acquis",
        transactionType: "hr_adjustment",
        quantity: -row.requestedDays,
        unit: "days",
        year: sourceYear,
        effectiveDate,
        sourceKind: "entitlement_carryover_out",
        sourceId: `${idempotencyKey}:out`,
        reason: `Art. 240 report sortant (${row.sourcePeriodKey}) — ${row.requestedDays} j (accord mutuel).`,
        actorEmployeeId: session.employee.id,
        metadataJson: {
          carryoverRequestId: row.id,
          sourcePeriodKey: row.sourcePeriodKey,
          targetPeriodKey: row.targetPeriodKey,
          art240: true,
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
        sourceId: `${idempotencyKey}:in`,
        reason: `Art. 240 report entrant (${row.targetPeriodKey}) depuis ${row.sourcePeriodKey}.`,
        actorEmployeeId: session.employee.id,
        metadataJson: {
          carryoverRequestId: row.id,
          sourcePeriodKey: row.sourcePeriodKey,
          art240: true,
          mutualAgreement: true,
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
