import { beforeEach, describe, expect, it } from "vitest";
import { createCalendarService } from "@/application/services/calendar-service";
import { createLeaveService } from "@/application/services/leave-service";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

const email = {
  async send() {
    return { queued: true as const, provider: "mock-email" };
  },
};

describe("leave + calendar regressions", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("conserve soumission / approbation / notification congés", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");
    const manager = testSessionFor("emp-julien", "chef_de_projet");

    const created = await leave.submit(collab, {
      type: "conges_payes",
      startDate: "2027-03-02",
      endDate: "2027-03-02",
      halfDayStart: false,
      halfDayEnd: false,
    });
    expect(created.status).toBe("en_attente_manager");

    const decided = await leave.decide(manager, created.id, "approuvee");
    expect(decided.status).toBe("approuvee");

    const history = await leave.listForCurrentUser(collab);
    expect(history.find((r) => r.id === created.id)?.status).toBe("approuvee");

    const notifs = await demoHrRepository.listNotifications("emp-lea");
    expect(notifs.some((n) => n.title.includes("approuvée"))).toBe(true);
  });

  it("reflète une décision de congés dans le calendrier", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const calendar = createCalendarService({ hr: demoHrRepository });
    const collab = testSessionFor("emp-lea", "collaborateur");
    const manager = testSessionFor("emp-julien", "chef_de_projet");

    const created = await leave.submit(collab, {
      type: "conges_payes",
      startDate: "2027-04-06",
      endDate: "2027-04-07",
      halfDayStart: false,
      halfDayEnd: false,
    });
    await leave.decide(manager, created.id, "approuvee");

    const { events } = await calendar.getEmployeeMonth(collab, "2027-04");
    const related = events.filter((e) => e.sourceRequestId === created.id);
    expect(related.length).toBe(2);
    expect(related.every((e) => e.tone === "leave_approved")).toBe(true);
  });

  it("conserve les restrictions de rôle sur les congés", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");
    await expect(leave.decide(collab, "leave-1", "approuvee")).rejects.toThrow(
      /Chef de projet/i,
    );
  });
});
