import { beforeEach, describe, expect, it } from "vitest";
import {
  createEntitlementService,
  resetEntitlementMemoryForTests,
} from "@/application/services/entitlement-service";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

describe("entitlement service accrual posting", () => {
  beforeEach(() => {
    resetDemoStore();
    resetEntitlementMemoryForTests();
  });

  it("previews then posts idempotently to the leave ledger", async () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    const session = testSessionFor("emp-camille", "admin_rh");

    const batch = await svc.createPreviewBatch(session, {
      year: 2026,
      month: 10,
    });
    expect(batch.status).toBe("preview");
    const postable = batch.lines.filter(
      (l) => l.calculationStatus === "calculated" && l.quantity > 0,
    );
    expect(postable.length).toBeGreaterThan(0);

    const first = await svc.postBatch(session, batch.id);
    expect(first.posted).toBeGreaterThan(0);
    expect(first.batch.status).toBe("posted");

    const second = await svc.postBatch(session, batch.id);
    expect(second.posted).toBe(0);

    const entries = await demoHrRepository.listLeaveLedgerEntries({
      year: 2026,
    });
    const accruals = entries.filter((e) => e.transactionType === "accrual");
    expect(accruals.length).toBe(first.posted);

    const keys = accruals.map((e) => e.sourceId);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("refuses collaborateur access to admin entitlement ops", async () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    await expect(
      svc.previewMonthlyAccruals(testSessionFor("emp-lea", "collaborateur"), {
        year: 2026,
        month: 11,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("does not auto-approve carryover above 5 days", async () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    const session = testSessionFor("emp-camille", "admin_rh");
    const employees = await demoHrRepository.listEmployees();
    const emp = employees[0]!;
    const row = await svc.requestCpCarryover(session, {
      employeeId: emp.id,
      sourcePeriodKey: "CP:2025-2026",
      targetPeriodKey: "CP:2026-2027",
      requestedDays: 8,
    });
    expect(row.status).toBe("en_attente_validation");
    await expect(
      svc.decideCarryover(session, {
        requestId: row.id,
        approve: true,
        decisionNote: "Sans validation partenaire",
      }),
    ).rejects.toThrow(/exception|5|partenaire/i);
  });
});
