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

  it("previews company CAP accruals but refuses auto-post until hr_configured", async () => {
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
    const companyLines = batch.lines.filter(
      (l) =>
        l.policyCode === "MA_ANNUAL_LEAVE_COMPANY" &&
        l.quantity > 0 &&
        l.calculationStatus === "requires_hr_validation",
    );
    expect(companyLines.length).toBeGreaterThan(0);

    const first = await svc.postBatch(session, batch.id);
    expect(first.posted).toBe(0);

    const accruals = (
      await demoHrRepository.listLeaveLedgerEntries({ year: 2026 })
    ).filter((e) => e.transactionType === "accrual");
    expect(accruals.length).toBe(0);
  });

  it("lists company CAP awaiting HR and FR inactive", () => {
    const leaveLedger = createLeaveLedgerService({ hr: demoHrRepository });
    const svc = createEntitlementService({
      hr: demoHrRepository,
      leaveLedger,
    });
    const policies = svc.listPolicyVersions();
    expect(
      policies.filter((p) => p.jurisdiction === "FR").every((p) => !p.isActive),
    ).toBe(true);
    const company = policies.find(
      (p) => p.policyCode === "MA_ANNUAL_LEAVE_COMPANY",
    );
    expect(company?.validationStatus).toBe("requires_hr_decision");
    expect(company?.isActive).toBe(true);
    expect(company?.rules.monthlyAccrualDays).toBe(2);
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
