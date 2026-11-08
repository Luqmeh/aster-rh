import { describe, expect, it } from "vitest";
import {
  assertLifecycleTransition,
  isEmploymentAccessible,
  isValidEmployeeEmail,
  isValidEmployeeId,
  syncIsActive,
} from "@/domain/rules/lifecycle";
import {
  canAssignRole,
  canModifyAccountRole,
} from "@/domain/rules/role-assignment";

describe("lifecycle", () => {
  it("synchronise l'accès applicatif", () => {
    expect(syncIsActive("actif")).toBe(true);
    expect(syncIsActive("inactif")).toBe(false);
    expect(syncIsActive("parti")).toBe(false);
    expect(isEmploymentAccessible("actif")).toBe(true);
  });

  it("valide les transitions", () => {
    expect(assertLifecycleTransition({ from: "actif", to: "parti" }).ok).toBe(
      true,
    );
    expect(
      assertLifecycleTransition({ from: "parti", to: "inactif" }).ok,
    ).toBe(false);
  });

  it("valide identifiants et e-mails", () => {
    expect(isValidEmployeeId("emp-new")).toBe(true);
    expect(isValidEmployeeId("x")).toBe(false);
    expect(isValidEmployeeEmail("a@b.co")).toBe(true);
    expect(isValidEmployeeEmail("bad")).toBe(false);
  });
});

describe("role assignment", () => {
  it("restreint la RH aux collaborateurs", () => {
    expect(canAssignRole("admin_rh", "collaborateur")).toBe(true);
    expect(canAssignRole("admin_rh", "chef_de_projet")).toBe(false);
    expect(canAssignRole("chef_de_projet", "admin_rh")).toBe(true);
  });

  it("empêche la RH de toucher un compte privilégié", () => {
    const result = canModifyAccountRole(
      "admin_rh",
      "chef_de_projet",
      "collaborateur",
    );
    expect(result.ok).toBe(false);
  });
});
