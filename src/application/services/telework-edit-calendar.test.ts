import { beforeEach, describe, expect, it } from "vitest";
import { createCalendarService } from "@/application/services/calendar-service";
import { createTeleworkService } from "@/application/services/telework-service";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

const email = {
  async send() {
    return { queued: true as const, provider: "mock-email" };
  },
};

describe("telework pending plan editing", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("met à jour les jours d'un plan en attente sans créer de doublon", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");

    const before = await tw.listForCurrentUser(collab);
    const pendingCountBefore = before.filter(
      (p) => p.month === "2026-12" && p.status === "en_attente_manager",
    ).length;
    expect(pendingCountBefore).toBe(1);

    const updated = await tw.updatePendingPlan(collab, "tw-1", {
      month: "2026-12",
      days: ["2026-12-02", "2026-12-04", "2026-12-09"],
      reason: "Jours révisés",
    });

    expect(updated.id).toBe("tw-1");
    expect(updated.days).toEqual(["2026-12-02", "2026-12-04", "2026-12-09"]);
    expect(updated.status).toBe("en_attente_manager");

    const after = await tw.listForCurrentUser(collab);
    const decemberPending = after.filter(
      (p) => p.month === "2026-12" && p.status === "en_attente_manager",
    );
    expect(decemberPending).toHaveLength(1);
  });

  it("refuse une mise à jour invalide (trop de jours / semaine)", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");

    await expect(
      tw.updatePendingPlan(collab, "tw-1", {
        month: "2026-12",
        days: ["2026-12-01", "2026-12-02", "2026-12-03"],
      }),
    ).rejects.toThrow(/semaine/i);
  });

  it("empêche de resoumettre un second plan pour le même mois", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");

    await expect(
      tw.submitMonthlyPlan(collab, {
        month: "2026-12",
        days: ["2026-12-07", "2026-12-09"],
      }),
    ).rejects.toThrow(/déjà en attente ou approuvé/i);
  });

  it("interdit la modification d'un plan approuvé ou refusé", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");
    const marc = testSessionFor("emp-marc", "collaborateur");

    await expect(
      tw.updatePendingPlan(collab, "tw-4", {
        month: "2026-11",
        days: ["2026-11-03"],
      }),
    ).rejects.toThrow(/en attente/i);

    await expect(
      tw.updatePendingPlan(marc, "tw-3", {
        month: "2026-11",
        days: ["2026-11-04"],
      }),
    ).rejects.toThrow(/en attente/i);
  });
});

describe("calendar consistency after telework decisions", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("montre pending puis approved après décision manager", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const calendar = createCalendarService({ hr: demoHrRepository });
    const collab = testSessionFor("emp-lea", "collaborateur");
    const manager = testSessionFor("emp-julien", "chef_de_projet");

    const pendingView = await calendar.getEmployeeMonth(collab, "2026-12");
    const pendingEvents = pendingView.events.filter(
      (e) => e.sourceRequestId === "tw-1",
    );
    expect(pendingEvents.length).toBeGreaterThan(0);
    expect(pendingEvents.every((e) => e.tone === "telework_pending")).toBe(
      true,
    );
    expect(pendingEvents.every((e) => e.title.includes("en attente"))).toBe(
      true,
    );

    await tw.decide(manager, "tw-1", "approuvee");

    const approvedView = await calendar.getEmployeeMonth(collab, "2026-12");
    const approvedEvents = approvedView.events.filter(
      (e) => e.sourceRequestId === "tw-1",
    );
    expect(approvedEvents.every((e) => e.tone === "telework_approved")).toBe(
      true,
    );
    expect(approvedEvents.some((e) => e.title.includes("non confirmé"))).toBe(
      false,
    );

    const ids = approvedEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("montre les refus comme non confirmés, jamais comme approuvés", async () => {
    const calendar = createCalendarService({ hr: demoHrRepository });
    const marc = testSessionFor("emp-marc", "collaborateur");
    const { events } = await calendar.getEmployeeMonth(marc, "2026-11");
    const rejected = events.filter((e) => e.sourceRequestId === "tw-3");
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected.every((e) => e.tone === "rejected")).toBe(true);
    expect(rejected.every((e) => e.title.includes("non confirmé"))).toBe(true);
    expect(rejected.some((e) => e.tone === "telework_approved")).toBe(false);
  });

  it("respecte la visibilité manager vs collaborateur", async () => {
    const calendar = createCalendarService({ hr: demoHrRepository });
    const collab = testSessionFor("emp-lea", "collaborateur");
    const manager = testSessionFor("emp-julien", "chef_de_projet");

    const employeeView = await calendar.getEmployeeMonth(collab, "2026-11");
    expect(
      employeeView.events.every(
        (e) => e.employeeId === "emp-lea" || e.kind === "holiday",
      ),
    ).toBe(true);

    const teamView = await calendar.getTeamMonth(manager, "2026-11");
    expect(teamView.events.some((e) => e.employeeId === "emp-lea")).toBe(true);
    expect(teamView.events.some((e) => e.employeeId === "emp-marc")).toBe(true);
  });
});
