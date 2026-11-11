import { beforeEach, describe, expect, it } from "vitest";
import {
  createEntitlementService,
  resetEntitlementMemoryForTests,
} from "@/application/services/entitlement-service";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

describe("entitlement service Phase 3 MA CAP", () => {
  beforeEach(() => {
    resetDemoStore();
    resetEntitlementMemoryForTests();
  });

  it("previews and posts idempotent MA accruals for eligible employees", async () => {
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

    const second = await svc.postBatch(session, batch.id);
    expect(second.posted).toBe(0);

    const accruals = (
      await demoHrRepository.listLeaveLedgerEntries({ year: 2026 })
    ).filter((e) => e.transactionType === "accrual");
    expect(accruals.length).toBe(first.posted);
    expect(new Set(accruals.map((e) => e.sourceId)).size).toBe(accruals.length);
  });

  it("lists MA policy as guide_documented and FR inactive", () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    const policies = svc.listPolicyVersions();
    expect(
      policies.filter((p) => p.jurisdiction === "FR").every((p) => !p.isActive),
    ).toBe(true);
    const ma = policies.find((p) => p.policyCode === "MA_ANNUAL_LEAVE_STATUTORY");
    expect(ma?.validationStatus).toBe("guide_documented");
    expect(ma?.isActive).toBe(true);
  });

  it("refuses collaborateur entitlement admin", async () => {
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

  it("allows chef_de_projet entitlement admin without granting leave approvals to RH", async () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    const preview = await svc.previewMonthlyAccruals(
      testSessionFor("emp-julien", "chef_de_projet"),
      { year: 2026, month: 10 },
    );
    expect(preview.lines.length).toBeGreaterThan(0);
  });

  it("carryover art.240 stays pending without silent auto-post", async () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    const session = testSessionFor("emp-camille", "admin_rh");
    const employees = await demoHrRepository.listEmployees();
    const row = await svc.requestCpCarryover(session, {
      employeeId: employees[0]!.id,
      sourcePeriodKey: "2025",
      targetPeriodKey: "2026",
      requestedDays: 3,
      exceptionReason: "Accord mutuel art. 240 (démo)",
      hasMutualAgreement: true,
    });
    expect(row.status).toBe("en_attente_validation");
  });

  it("rejects art.240 carryover without mutual agreement", async () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    const session = testSessionFor("emp-camille", "admin_rh");
    const employees = await demoHrRepository.listEmployees();
    await expect(
      svc.requestCpCarryover(session, {
        employeeId: employees[0]!.id,
        sourcePeriodKey: "2025",
        targetPeriodKey: "2026",
        requestedDays: 2,
        hasMutualAgreement: false,
      }),
    ).rejects.toThrow(/240/);
  });
});
