import { beforeEach, describe, expect, it } from "vitest";
import { createLeaveService } from "@/application/services/leave-service";
import { createTeleworkService } from "@/application/services/telework-service";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

const emails: { to: string; subject: string }[] = [];

const email = {
  async send(message: { to: string; subject: string; body: string }) {
    emails.push({ to: message.to, subject: message.subject });
    return { queued: true as const, provider: "mock-email" };
  },
};

describe("approval workflow — congés", () => {
  beforeEach(() => {
    resetDemoStore();
    emails.length = 0;
  });

  it("approuve une demande : statut, historique employé, notification", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");
    const chef = testSessionFor("emp-julien", "chef_de_projet");

    const created = await leave.submit(collab, {
      type: "conges_payes",
      startDate: "2026-11-24",
      endDate: "2026-11-24",
      halfDayStart: false,
      halfDayEnd: false,
      comment: "Test workflow",
    });
    expect(created.status).toBe("en_attente_manager");

    const pending = await leave.listTeamPending(chef);
    expect(pending.some((r) => r.id === created.id)).toBe(true);

    const updated = await leave.decide(chef, created.id, "approuvee");
    expect(updated.status).toBe("approuvee");

    const history = await leave.listForCurrentUser(collab);
    const visible = history.find((r) => r.id === created.id);
    expect(visible?.status).toBe("approuvee");

    const notifs = await demoHrRepository.listNotifications("emp-lea");
    expect(
      notifs.some(
        (n) => n.title.includes("approuvée") && n.body.length > 0,
      ),
    ).toBe(true);
    expect(emails.some((e) => e.subject.includes("approuvés"))).toBe(true);
  });

  it("refuse une demande et notifie le collaborateur", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");
    const chef = testSessionFor("emp-julien", "chef_de_projet");

    const created = await leave.submit(collab, {
      type: "conges_payes",
      startDate: "2026-11-25",
      endDate: "2026-11-25",
      halfDayStart: false,
      halfDayEnd: false,
    });

    const updated = await leave.decide(
      chef,
      created.id,
      "refusee",
      "Charge d'équipe",
    );
    expect(updated.status).toBe("refusee");
    expect(updated.managerComment).toBe("Charge d'équipe");

    const history = await leave.listForCurrentUser(collab);
    expect(history.find((r) => r.id === created.id)?.status).toBe("refusee");

    const notifs = await demoHrRepository.listNotifications("emp-lea");
    expect(notifs.some((n) => n.title.includes("refusée"))).toBe(true);
  });

  it("échoue pour un collaborateur qui tente d'approuver", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");

    await expect(
      leave.decide(collab, "leave-1", "approuvee"),
    ).rejects.toThrow(/Chef de projet/i);
  });

  it("échoue sur une demande déjà traitée (pas de décision contradictoire)", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const chef = testSessionFor("emp-julien", "chef_de_projet");

    await leave.decide(chef, "leave-1", "approuvee");
    await expect(
      leave.decide(chef, "leave-1", "refusee"),
    ).rejects.toThrow(/déjà été traitée/i);

    const request = await demoHrRepository.getLeaveRequest("leave-1");
    expect(request?.status).toBe("approuvee");
  });

  it("autorise le Chef de projet hors rattachement hiérarchique (portée globale)", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    // Camille n'est pas le manager de Léa, mais en Chef de projet elle peut décider.
    const outsiderChef = testSessionFor("emp-camille", "chef_de_projet");

    const updated = await leave.decide(outsiderChef, "leave-1", "approuvee");
    expect(updated.status).toBe("approuvee");
  });

  it("refuse à un compte RH d'approuver toute file", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const hr = testSessionFor("emp-camille", "admin_rh");

    await expect(leave.decide(hr, "leave-1", "approuvee")).rejects.toThrow(
      /ressources humaines/i,
    );
  });

  it("laisse le RH consulter la file sans décider", async () => {
    const leave = createLeaveService({ hr: demoHrRepository, email });
    const hr = testSessionFor("emp-camille", "admin_rh");
    const pending = await leave.listTeamPending(hr);
    expect(pending.length).toBeGreaterThan(0);
  });
});

describe("approval workflow — télétravail", () => {
  beforeEach(() => {
    resetDemoStore();
    emails.length = 0;
  });

  it("approuve un plan mensuel de bout en bout", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");
    const chef = testSessionFor("emp-julien", "chef_de_projet");

    const created = await tw.submitMonthlyPlan(collab, {
      month: "2027-01",
      days: ["2027-01-05", "2027-01-07", "2027-01-12"],
      reason: "Plan janvier démo",
    });
    expect(created.status).toBe("en_attente_manager");
    expect(created.month).toBe("2027-01");

    const pending = await tw.listTeamPending(chef);
    expect(pending.some((r) => r.id === created.id)).toBe(true);

    const updated = await tw.decide(chef, created.id, "approuvee");
    expect(updated.status).toBe("approuvee");

    const history = await tw.listForCurrentUser(collab);
    expect(history.find((r) => r.id === created.id)?.status).toBe("approuvee");

    const notifs = await demoHrRepository.listNotifications("emp-lea");
    expect(notifs.some((n) => n.title.includes("approuvé"))).toBe(true);
  });

  it("refuse un plan avec motif et bloque le double traitement", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const chef = testSessionFor("emp-julien", "chef_de_projet");

    await expect(tw.decide(chef, "tw-1", "refusee")).rejects.toThrow(
      /motif de refus/i,
    );

    await tw.decide(chef, "tw-1", "refusee", "Continuité de service");
    await expect(
      tw.decide(chef, "tw-1", "approuvee", "trop tard"),
    ).rejects.toThrow(/déjà été traitée/i);
    const request = await demoHrRepository.getTeleworkRequest("tw-1");
    expect(request?.status).toBe("refusee");
    expect(request?.managerComment).toMatch(/Continuité/);
  });

  it("bloque le rôle collaborateur sur télétravail", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const collab = testSessionFor("emp-lea", "collaborateur");
    await expect(tw.decide(collab, "tw-1", "approuvee")).rejects.toThrow(
      /Chef de projet/i,
    );
  });

  it("refuse un profil non éligible", async () => {
    const tw = createTeleworkService({ hr: demoHrRepository, email });
    const hugo = testSessionFor("emp-hugo", "collaborateur");
    await expect(
      tw.submitMonthlyPlan(hugo, {
        month: "2027-02",
        days: ["2027-02-02"],
      }),
    ).rejects.toThrow(/éligible/i);
  });
});
