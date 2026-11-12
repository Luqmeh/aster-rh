import { beforeEach, describe, expect, it } from "vitest";
import { createPeopleManagerService } from "@/application/services/people-manager-service";
import { assertCanDecideRequest } from "@/domain/rules/approvals";
import { employees } from "@/data/demo-seed";
import { AuthError } from "@/infrastructure/auth/authorization";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

describe("people-manager-service", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  const service = () => createPeopleManagerService({ hr: demoHrRepository });

  it("autorise Responsable RH et Senior Manager à créer et lister", async () => {
    for (const [id, role] of [
      ["emp-camille", "admin_rh"],
      ["emp-julien", "chef_de_projet"],
    ] as const) {
      const session = testSessionFor(id, role);
      const created = await service().create(session, {
        displayName: `Manager externe ${role}`,
      });
      expect(created.linkedEmployeeId).toBeNull();
      const list = await service().list(session);
      expect(list.some((p) => p.id === created.id)).toBe(true);
    }
  });

  it("refuse le catalogue au collaborateur", async () => {
    const session = testSessionFor("emp-lea", "collaborateur");
    await expect(
      service().create(session, { displayName: "Intrus" }),
    ).rejects.toBeInstanceOf(AuthError);
    await expect(service().list(session)).rejects.toBeInstanceOf(AuthError);
  });

  it("refuse un nom vide ou en doublon", async () => {
    const session = testSessionFor("emp-camille", "admin_rh");
    await expect(
      service().create(session, { displayName: "   " }),
    ).rejects.toThrow(/obligatoire/);
    await expect(
      service().create(session, { displayName: "youssef  ALAOUI" }),
    ).rejects.toThrow(/existe déjà/);
  });

  it("listTeamMembers : People Manager lié OU managerId legacy", async () => {
    const hr = demoHrRepository;
    const session = testSessionFor("emp-camille", "admin_rh");
    const pm = await service().create(session, {
      displayName: "Sara (équipe via PM)",
      linkedEmployeeId: "emp-sarah",
    });
    await hr.updateEmployee("emp-thomas", { peopleManagerId: pm.id });
    const team = await hr.listTeamMembers("emp-sarah");
    expect(team.map((e) => e.id)).toContain("emp-thomas");

    // Legacy : managerId seul (sans PM) reste pris en compte.
    const legacy = await hr.listTeamMembers("emp-camille");
    expect(legacy.length).toBeGreaterThan(0);
  });

  it("l'affectation People Manager n'accorde aucune autorité d'approbation", () => {
    const julien = employees.find((e) => e.id === "emp-julien")!;
    const lea = employees.find((e) => e.id === "emp-lea")!;
    for (const role of ["collaborateur", "admin_rh"] as const) {
      const result = assertCanDecideRequest({
        role,
        actor: julien,
        subject: { ...lea, peopleManagerId: "pm-from-emp-julien" },
        status: "en_attente_manager",
      });
      expect(result.ok).toBe(false);
    }
  });
});
