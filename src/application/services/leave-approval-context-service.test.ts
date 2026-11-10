import { beforeEach, describe, expect, it } from "vitest";
import { createLeaveApprovalContextService } from "@/application/services/leave-approval-context-service";
import { createLeaveService } from "@/application/services/leave-service";
import { AuthError } from "@/infrastructure/auth/authorization";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import { mockEmail } from "@/infrastructure/email/mock-email";

describe("leave-approval-context-service", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("autorise le Chef à lire le contexte des demandes en file", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email: mockEmail });
    const ctx = createLeaveApprovalContextService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");
    const chef = testSessionFor("emp-julien", "chef_de_projet");

    const created = await leave.submit(lea, {
      type: "conges_payes",
      startDate: "2026-09-14",
      endDate: "2026-09-15",
      halfDayStart: false,
      halfDayEnd: false,
      comment: "Pont",
    });
    const pending = await leave.listTeamPending(chef);
    const map = await ctx.getLeaveRequestContexts(chef, pending);
    const panel = map[created.id];
    expect(panel).toBeTruthy();
    expect(panel.employee.employeeId).toBe("emp-lea");
    expect(panel.balance.tracked).toBe(true);
    expect(panel.balance.requestDays).toBe(created.daysCount);
    expect(panel.canDecide).toBe(true);
    expect(panel.viewerCanSeeMedical).toBe(false);
  });

  it("laisse la RH consulter le contexte sans autorité de décision", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email: mockEmail });
    const ctx = createLeaveApprovalContextService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");
    const hr = testSessionFor("emp-camille", "admin_rh");

    const created = await leave.submit(lea, {
      type: "rtt",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      halfDayStart: false,
      halfDayEnd: false,
    });
    const map = await ctx.getLeaveRequestContexts(hr, [created]);
    expect(map[created.id]?.canDecide).toBe(false);
    expect(map[created.id]?.balance.leaveType).toBe("rtt");
  });

  it("refuse au collaborateur l'accès au contexte d'un tiers", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email: mockEmail });
    const ctx = createLeaveApprovalContextService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");
    const created = await leave.submit(lea, {
      type: "conges_payes",
      startDate: "2026-11-02",
      endDate: "2026-11-03",
      halfDayStart: false,
      halfDayEnd: false,
    });
    await expect(
      ctx.getLeaveRequestContexts(lea, [created]),
    ).rejects.toThrow(AuthError);
  });

  it("expose Solde non suivi pour exceptionnel / parental / sans solde", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email: mockEmail });
    const ctx = createLeaveApprovalContextService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    const created = await leave.submit(lea, {
      type: "exceptionnel",
      startDate: "2026-12-01",
      endDate: "2026-12-01",
      halfDayStart: false,
      halfDayEnd: false,
    });
    const panel = (await ctx.getLeaveRequestContexts(chef, [created]))[
      created.id
    ];
    expect(panel.balance.tracked).toBe(false);
    expect(panel.balance.untrackedLabel).toBe("Solde non suivi");
  });

  it("isole le médical sur le contexte d'absence Chef", async () => {
    const store = (
      await import("@/infrastructure/persistence/demo-store")
    ).getDemoStore();
    store.workAbsences.push({
      id: "wa-ctx-1",
      employeeId: "emp-lea",
      family: "arret",
      category: "arret_maladie",
      status: "en_attente_justificatif",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      daysCount: 5,
      employeeComment: "diagnostic secret",
      hrInternalNote: "note RH",
      hrMessage: null,
      rejectionReason: null,
      parentAbsenceId: null,
      recurrenceOfId: null,
      dateGapFlag: false,
      recurrenceWithin3MonthsFlag: false,
      requiresHrReview: false,
      hospitalAdmissionDate: null,
      hospitalDischargeDate: null,
      documentsReceived: false,
      firstDocumentReceivedAt: null,
      payrollProcessingMonth: null,
      expectedReturnDate: "2026-06-08",
      actualReturnDate: null,
      returnVisitRequired: false,
      returnVisitStatus: "non_applicable",
      returnVisitPlannedDate: null,
      returnVisitDeadline: null,
      processedByEmployeeId: null,
      processedAt: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });

    const ctx = createLeaveApprovalContextService({ hr: demoHrRepository });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    const panel = await ctx.getWorkAbsenceContext(chef, "wa-ctx-1");
    expect(panel.includesMedicalDocuments).toBe(false);
    expect(panel.includesMedicalDetails).toBe(false);
    expect(panel.canDecide).toBe(false);
    expect(panel.balanceLabel).toBe("Solde non suivi");
    expect(JSON.stringify(panel)).not.toContain("diagnostic secret");
    expect(JSON.stringify(panel)).not.toContain("note RH");
  });

  it("fournit le barème spécial sans inventer un plafond absent", async () => {
    const store = (
      await import("@/infrastructure/persistence/demo-store")
    ).getDemoStore();
    store.workAbsences.push({
      id: "wa-special-1",
      employeeId: "emp-lea",
      family: "conge_special",
      category: "hospitalisation_enfant",
      status: "en_attente_justificatif",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      daysCount: 3,
      employeeComment: null,
      hrInternalNote: null,
      hrMessage: null,
      rejectionReason: null,
      parentAbsenceId: null,
      recurrenceOfId: null,
      dateGapFlag: false,
      recurrenceWithin3MonthsFlag: false,
      requiresHrReview: true,
      hospitalAdmissionDate: null,
      hospitalDischargeDate: null,
      documentsReceived: false,
      firstDocumentReceivedAt: null,
      payrollProcessingMonth: null,
      expectedReturnDate: null,
      actualReturnDate: null,
      returnVisitRequired: false,
      returnVisitStatus: "non_applicable",
      returnVisitPlannedDate: null,
      returnVisitDeadline: null,
      processedByEmployeeId: null,
      processedAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    const ctx = createLeaveApprovalContextService({ hr: demoHrRepository });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    const panel = await ctx.getWorkAbsenceContext(chef, "wa-special-1");
    expect(panel.specialLeave?.maxDays).toBeNull();
    expect(panel.specialLeave?.requiresHrReview).toBe(true);
  });
});
