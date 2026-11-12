import { beforeEach, describe, expect, it } from "vitest";
import { createEmployeeProvisioningService } from "@/application/services/employee-provisioning-service";
import { AuthError } from "@/infrastructure/auth/authorization";
import {
  findAccountByEmail,
  findAccountByEmployeeId,
  resetMemoryAccountsForTests,
} from "@/infrastructure/auth/account-store";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

const email = {
  async send() {
    return { queued: true as const, provider: "mock-email" };
  },
};

describe("employee provisioning & lifecycle", () => {
  beforeEach(() => {
    resetDemoStore();
    resetMemoryAccountsForTests();
  });

  it("crée une fiche et un compte collaborateur pour la RH", async () => {
    const service = createEmployeeProvisioningService({
      hr: demoHrRepository,
      email,
    });
    const hr = testSessionFor("emp-camille", "admin_rh");
    const result = await service.onboard(hr, {
      id: "emp-new-1",
      firstName: "Nora",
      lastName: "Petit",
      email: "nora.petit@demo.aster-rh.local",
      jobTitle: "Consultante",
      departmentId: "dept-audit",
      peopleManagerId: "pm-from-emp-julien",
      region: "Casablanca",
      contractType: "cdi",
      grade: "auditeur_senior",
      hireDate: "2026-11-01",
      role: "collaborateur",
    });
    expect(result.employee.id).toBe("emp-new-1");
    expect(result.temporaryPassword).toBeTruthy();
    const account = await findAccountByEmail("nora.petit@demo.aster-rh.local");
    expect(account?.role).toBe("collaborateur");
    expect(account?.employeeId).toBe("emp-new-1");
    expect(account?.mustChangePassword).toBe(true);
  });

  it("refuse à la RH de provisionner un Chef de projet", async () => {
    const service = createEmployeeProvisioningService({
      hr: demoHrRepository,
      email,
    });
    const hr = testSessionFor("emp-camille", "admin_rh");
    await expect(
      service.onboard(hr, {
        id: "emp-bad",
        firstName: "X",
        lastName: "Y",
        email: "x.y@demo.aster-rh.local",
        jobTitle: "X",
        departmentId: "dept-audit",
        peopleManagerId: null,
        region: "Casablanca",
        contractType: "cdi",
        grade: "auditeur_senior",
        hireDate: "2026-11-01",
        role: "chef_de_projet",
      }),
    ).rejects.toThrow(AuthError);
  });

  it("empêche les doublons e-mail / id", async () => {
    const service = createEmployeeProvisioningService({
      hr: demoHrRepository,
      email,
    });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    await expect(
      service.onboard(chef, {
        id: "emp-lea",
        firstName: "Léa",
        lastName: "Dubois",
        email: "autre@demo.aster-rh.local",
        jobTitle: "X",
        departmentId: "dept-audit",
        peopleManagerId: null,
        region: "Casablanca",
        contractType: "cdi",
        grade: "auditeur_senior",
        hireDate: "2026-11-01",
      }),
    ).rejects.toThrow(/déjà utilisé/i);
  });

  it("désactive le compte lors d'un départ", async () => {
    const service = createEmployeeProvisioningService({
      hr: demoHrRepository,
      email,
    });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    await service.onboard(chef, {
      id: "emp-temp",
      firstName: "Temp",
      lastName: "User",
      email: "temp.user@demo.aster-rh.local",
      jobTitle: "Analyste",
      departmentId: "dept-audit",
      peopleManagerId: null,
      region: "Rabat",
      contractType: "cdd",
      grade: "auditeur_junior",
      hireDate: "2026-01-01",
    });

    const updated = await service.changeLifecycle(chef, "emp-temp", "parti", {
      departureDate: "2026-11-08",
      departureNote: "Fin de mission",
    });
    expect(updated.employmentStatus).toBe("parti");
    expect(updated.isActive).toBe(false);
    const account = await findAccountByEmployeeId("emp-temp");
    expect(account?.isActive).toBe(false);
    const history = await demoHrRepository.listLeaveRequests({
      employeeId: "emp-lea",
    });
    expect(history.length).toBeGreaterThan(0);
  });

  it("refuse à la RH de promouvoir un compte", async () => {
    const service = createEmployeeProvisioningService({
      hr: demoHrRepository,
      email,
    });
    const chef = testSessionFor("emp-julien", "chef_de_projet");
    const hr = testSessionFor("emp-camille", "admin_rh");
    await service.onboard(chef, {
      id: "emp-promo",
      firstName: "Sam",
      lastName: "Lee",
      email: "sam.lee@demo.aster-rh.local",
      jobTitle: "Consultant",
      departmentId: "dept-audit",
      peopleManagerId: null,
      region: "Casablanca",
      contractType: "cdi",
      grade: "auditeur_senior",
      hireDate: "2026-02-01",
    });
    await expect(
      service.changeRole(hr, "emp-promo", "admin_rh"),
    ).rejects.toThrow(AuthError);
  });
});
