import { beforeEach, describe, expect, it } from "vitest";
import {
  createEntitlementService,
  resetEntitlementMemoryForTests,
} from "@/application/services/entitlement-service";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

describe("entitlement service Morocco-first", () => {
  beforeEach(() => {
    resetDemoStore();
    resetEntitlementMemoryForTests();
  });

  it("previews without posting unverified Moroccan accruals", async () => {
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
    expect(postable.length).toBe(0);

    const first = await svc.postBatch(session, batch.id);
    expect(first.posted).toBe(0);
    expect(first.batch.status).toBe("posted");

    const accruals = (
      await demoHrRepository.listLeaveLedgerEntries({ year: 2026 })
    ).filter((e) => e.transactionType === "accrual");
    expect(accruals.length).toBe(0);
  });

  it("lists FR policies as inactive historical and MA policy as requires decision", () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    const policies = svc.listPolicyVersions();
    expect(policies.filter((p) => p.jurisdiction === "FR").every((p) => !p.isActive)).toBe(
      true,
    );
    const ma = policies.find((p) => p.policyCode === "MA_ANNUAL_LEAVE_STATUTORY");
    expect(ma?.validationStatus).toBe("requires_hr_decision");
    expect(ma?.isActive).toBe(true);
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
});
