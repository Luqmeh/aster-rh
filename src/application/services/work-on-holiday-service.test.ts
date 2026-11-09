import { beforeEach, describe, expect, it } from "vitest";
import { createWorkOnHolidayService } from "@/application/services/work-on-holiday-service";
import { hoursToRecoveryDays } from "@/domain/rules/work-on-holiday";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { mockEmail } from "@/infrastructure/email/mock-email";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { Employee } from "@/domain/types/hr";

function sessionFor(
  employee: Employee,
  role: AuthSession["role"],
): AuthSession {
  return {
    userId: `acc-${employee.id}`,
    email: employee.email,
    employee,
    role,
    authProvider: "credentials",
    isDemoMode: true,
  };
}

describe("work-on-holiday-service", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  async function emp(id: string) {
    const e = await demoHrRepository.getEmployee(id);
    if (!e) throw new Error("missing");
    return e;
  }

  it("crédite proportionnellement 1h = 1h (conversion jours)", () => {
    expect(hoursToRecoveryDays(4, 8)).toBe(0.5);
    expect(hoursToRecoveryDays(7, 7)).toBe(1);
    expect(hoursToRecoveryDays(8, 8)).toBe(1);
  });

  it("empêche les doublons et l'accès croisé", async () => {
    const service = createWorkOnHolidayService({
      hr: demoHrRepository,
      email: mockEmail,
    });
    const lea = await emp("emp-lea");
    const julien = await emp("emp-julien");
    // date future nationale
    const created = await service.submit(sessionFor(lea, "collaborateur"), {
      holidayDate: "2027-01-01",
      plannedHours: 7,
      reason: "Livraison client critique",
    });
    await expect(
      service.submit(sessionFor(lea, "collaborateur"), {
        holidayDate: "2027-01-01",
        plannedHours: 4,
        reason: "Deuxième tentative",
      }),
    ).rejects.toThrow(/demande active/i);

    await expect(
      service.getVisible(sessionFor(julien, "collaborateur"), created.id),
    ).rejects.toThrow(/refusé/i);
  });

  it("RH ne peut pas approuver ; Chef peut", async () => {
    const service = createWorkOnHolidayService({
      hr: demoHrRepository,
      email: mockEmail,
    });
    const lea = await emp("emp-lea");
    const camille = await emp("emp-camille");
    const julien = await emp("emp-julien");
    const created = await service.submit(sessionFor(lea, "collaborateur"), {
      holidayDate: "2027-01-11",
      plannedHours: 6,
      reason: "Astreinte production",
    });

    await expect(
      service.decide(sessionFor(camille, "admin_rh"), created.id, "approuvee"),
    ).rejects.toThrow(/Chefs de projet/i);

    const approved = await service.decide(
      sessionFor(julien, "chef_de_projet"),
      created.id,
      "approuvee",
    );
    expect(approved.status).toBe("approuvee");
  });

  it("n'applique pas de crédit avant confirmation et refuse le double crédit", async () => {
    const service = createWorkOnHolidayService({
      hr: demoHrRepository,
      email: mockEmail,
    });
    const lea = await emp("emp-lea");
    const julien = await emp("emp-julien");
    const created = await service.submit(sessionFor(lea, "collaborateur"), {
      holidayDate: "2027-01-14",
      plannedHours: 8,
      reason: "Support événement",
    });
    await service.decide(
      sessionFor(julien, "chef_de_projet"),
      created.id,
      "approuvee",
    );

    // forcer la date passée pour déclaration (après approbation)
    await demoHrRepository.updateWorkOnHolidayRequest(created.id, {
      holidayDate: "2026-01-01",
    });

    await service.declareActualHours(
      sessionFor(lea, "collaborateur"),
      created.id,
      8,
    );

    const before = await demoHrRepository.getLeaveBalance("emp-lea", 2026);
    const recoveryBefore = before?.recoveryDaysRestants ?? 0;

    await expect(
      service.confirmAndCredit(
        sessionFor(lea, "collaborateur"),
        created.id,
        8,
      ),
    ).rejects.toThrow(/Chef de projet/i);

    const credited = await service.confirmAndCredit(
      sessionFor(julien, "chef_de_projet"),
      created.id,
      8,
    );
    expect(credited.status).toBe("confirmee_credit_appliquee");
    expect(credited.creditLedgerId).toBeTruthy();

    const after = await demoHrRepository.getLeaveBalance("emp-lea", 2026);
    // 8 h / 7 h journalières (profil Léa) ≈ 1.143 j
    expect(after!.recoveryDaysRestants).toBeCloseTo(
      recoveryBefore + hoursToRecoveryDays(8, lea.standardDailyHours),
      5,
    );

    await expect(
      service.confirmAndCredit(
        sessionFor(julien, "chef_de_projet"),
        created.id,
        8,
      ),
    ).rejects.toThrow(/déjà/i);

    await expect(
      service.listRecoveryCredits(sessionFor(julien, "collaborateur"), "emp-lea"),
    ).rejects.toThrow(/refus/i);
  });

  it("affiche les fériés dans le calendrier sans créer de demande", async () => {
    const { buildCalendarEvents } = await import(
      "@/domain/rules/calendar-events"
    );
    const service = createWorkOnHolidayService({
      hr: demoHrRepository,
      email: mockEmail,
    });
    const holidays = await service.listHolidays([2026]);
    const events = buildCalendarEvents({
      month: "2026-11",
      leaves: [],
      telework: [],
      holidays,
      workOnHoliday: [],
    });
    expect(events.some((e) => e.kind === "holiday" && e.date === "2026-11-06")).toBe(
      true,
    );
    expect(events.every((e) => e.kind !== "work_on_holiday")).toBe(true);
  });
});
