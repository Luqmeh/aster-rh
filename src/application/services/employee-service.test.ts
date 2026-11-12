import { beforeEach, describe, expect, it } from "vitest";
import { createEmployeeService } from "@/application/services/employee-service";
import { AuthError } from "@/infrastructure/auth/authorization";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

describe("employee directory & profiles", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("autorise Chef de projet et RH à parcourir l'annuaire", async () => {
    const service = createEmployeeService({ hr: demoHrRepository });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    const hr = testSessionFor("emp-camille", "admin_rh");

    const forChef = await service.listDirectory(chef, { status: "actif" });
    const forHr = await service.listDirectory(hr, { status: "actif" });
    expect(forChef.length).toBeGreaterThan(0);
    expect(forHr.length).toBeGreaterThan(0);
  });

  it("refuse l'annuaire aux collaborateurs", async () => {
    const service = createEmployeeService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");
    await expect(service.listDirectory(lea)).rejects.toThrow(AuthError);
  });

  it("autorise le collaborateur sur sa propre fiche uniquement", async () => {
    const service = createEmployeeService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");

    await expect(service.getProfile(lea, "emp-lea")).resolves.toMatchObject({
      id: "emp-lea",
    });
    await expect(service.getProfile(lea, "emp-marc")).rejects.toThrow(
      AuthError,
    );
  });

  it("autorise le collaborateur à éditer uniquement les champs personnels", async () => {
    const service = createEmployeeService({ hr: demoHrRepository });
    const lea = testSessionFor("emp-lea", "collaborateur");

    const updated = await service.updatePersonal(lea, "emp-lea", {
      phoneInternal: "01 00 00 00 00",
    });
    expect(updated.phoneInternal).toBe("01 00 00 00 00");
    const before = await service.getProfile(lea, "emp-lea");

    // Région / grade non modifiables par le collaborateur (patch ignoré).
    const sneaky = await service.updatePersonal(lea, "emp-lea", {
      phoneInternal: "01 00 00 00 01",
      region: "Tanger",
      grade: before.grade === "manager" ? "auditeur_junior" : "manager",
    } as never);
    expect(sneaky.region).toBe(before.region);
    expect(sneaky.grade).toBe(before.grade);

    await expect(
      service.updateHrRecord(lea, "emp-lea", { jobTitle: "Hack" }),
    ).rejects.toThrow(AuthError);
  });

  it("autorise la RH à mettre à jour une fiche RH", async () => {
    const service = createEmployeeService({ hr: demoHrRepository });
    const hr = testSessionFor("emp-camille", "admin_rh");
    const updated = await service.updateHrRecord(hr, "emp-lea", {
      jobTitle: "Consultante audit senior",
    });
    expect(updated.jobTitle).toBe("Consultante audit senior");
  });
});
