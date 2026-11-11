import { beforeEach, describe, expect, it } from "vitest";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import { createLeaveService } from "@/application/services/leave-service";
import { AuthError } from "@/infrastructure/auth/authorization";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { mockEmail } from "@/infrastructure/email/mock-email";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import { OPENING_SOURCE_KIND } from "@/domain/rules/leave-ledger-balance";

describe("leave-ledger-service", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("backfill les soldes d'ouverture de façon idempotente", async () => {
    const ledger = createLeaveLedgerService({ hr: demoHrRepository });
    const first = await ledger.backfillOpeningBalancesFromSnapshots({
      year: 2026,
    });
    expect(first.created).toBeGreaterThan(0);
    const second = await ledger.backfillOpeningBalancesFromSnapshots({
      year: 2026,
    });
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(first.created);

    const lea = testSessionFor("emp-lea", "collaborateur");
    const cp = await ledger.getAccountBalance(lea, {
      employeeId: "emp-lea",
      account: "conges_payes",
      year: 2026,
    });
    // Seed Imane (emp-lea) : 18 acquis, 8 pris, 10 restants (démo Maroc)
    expect(cp.totalCredited).toBe(18);
    expect(cp.totalConsumed).toBe(8);
    expect(cp.ledgerBalance).toBe(10);
  });

  it("n'écrit pas de consommation tant que la demande est pending", async () => {
    const leave = createLeaveService({
      hr: demoHrRepository,
      email: mockEmail,
    });
    const ledger = createLeaveLedgerService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");
    await ledger.ensureBackfill(2026);
    const before = await ledger.getAccountBalance(lea, {
      employeeId: "emp-lea",
      account: "conges_payes",
    });
    await leave.submit(lea, {
      type: "conges_payes",
      startDate: "2026-09-14",
      endDate: "2026-09-15",
      halfDayStart: false,
      halfDayEnd: false,
    });
    const after = await ledger.getAccountBalance(lea, {
      employeeId: "emp-lea",
      account: "conges_payes",
    });
    expect(after.ledgerBalance).toBe(before.ledgerBalance);
    expect(after.otherPendingReservations).toBeGreaterThan(0);
  });

  it("débite une seule fois à l'approbation (idempotent)", async () => {
    const leave = createLeaveService({
      hr: demoHrRepository,
      email: mockEmail,
    });
    const ledger = createLeaveLedgerService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    await ledger.ensureBackfill(2026);
    const before = await ledger.getBalanceForLeaveType(
      lea,
      "emp-lea",
      "conges_payes",
      2026,
    );
    const req = await leave.submit(lea, {
      type: "conges_payes",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      halfDayStart: false,
      halfDayEnd: false,
    });
    await leave.decide(chef, req.id, "approuvee");
    await leave.decide(chef, req.id, "approuvee").catch(() => undefined);
    // Second decide may throw terminal — force duplicate consumption call
    await ledger.recordApprovedLeaveConsumption({
      request: { ...req, status: "approuvee" },
      actorEmployeeId: chef.employee.id,
    });
    const after = await ledger.getBalanceForLeaveType(
      lea,
      "emp-lea",
      "conges_payes",
      2026,
    );
    expect(after!.ledgerBalance).toBeCloseTo(
      before!.ledgerBalance - req.daysCount,
      4,
    );
    const consumptions = (
      await demoHrRepository.listLeaveLedgerEntries({
        employeeId: "emp-lea",
      })
    ).filter(
      (e) =>
        e.transactionType === "leave_consumption" &&
        String(e.sourceId).startsWith(req.id),
    );
    expect(consumptions.length).toBeGreaterThanOrEqual(1);
  });

  it("refuse l'ajustement aux collaborateurs et autorise RH/Chef", async () => {
    const ledger = createLeaveLedgerService({ hr: demoHrRepository });
    await ledger.ensureBackfill(2026);
    const lea = testSessionFor("emp-lea", "collaborateur");
    const hr = testSessionFor("emp-camille", "admin_rh");
    await expect(
      ledger.adjustBalance(lea, {
        employeeId: "emp-lea",
        account: "conges_payes",
        quantity: 1,
        effectiveDate: "2026-11-01",
        reason: "Correction test",
      }),
    ).rejects.toThrow(AuthError);

    const entry = await ledger.adjustBalance(hr, {
      employeeId: "emp-lea",
      account: "conges_payes",
      quantity: 1,
      effectiveDate: "2026-11-01",
      reason: "Correction RH test",
    });
    expect(entry.transactionType).toBe("hr_adjustment");
    expect(entry.sourceKind).toBe("hr_adjustment");
  });

  it("isole la consultation des soldes entre collaborateurs", async () => {
    const ledger = createLeaveLedgerService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");
    await expect(
      ledger.getAccountBalance(lea, {
        employeeId: "emp-julien",
        account: "conges_payes",
      }),
    ).rejects.toThrow(AuthError);
  });

  it("enregistre un crédit récupération une seule fois", async () => {
    const ledger = createLeaveLedgerService({ hr: demoHrRepository });
    await ledger.ensureBackfill(2026);
    const input = {
      employeeId: "emp-lea",
      year: 2026,
      daysCredited: 1,
      hoursConfirmed: 7,
      sourceRequestId: "woh-1",
      actorEmployeeId: "emp-julien",
      effectiveDate: "2026-08-15",
    };
    await ledger.recordRecoveryCredit(input);
    await ledger.recordRecoveryCredit(input);
    const rows = await demoHrRepository.listLeaveLedgerEntries({
      employeeId: "emp-lea",
      account: "recuperation",
    });
    const credits = rows.filter((e) => e.transactionType === "recovery_credit");
    expect(credits).toHaveLength(1);
    expect(credits[0].sourceKind).not.toBe(OPENING_SOURCE_KIND);
  });
});
