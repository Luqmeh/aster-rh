import { describe, expect, it } from "vitest";
import {
  AuthError,
  canAccessEmployeeRecord,
  isRouteAllowedForRole,
  requireRole,
} from "@/infrastructure/auth/authorization";
import { testSessionFor } from "@/infrastructure/auth/test-session";
import { employees } from "@/data/demo-seed";
import {
  assertLoginRateLimit,
  resetLoginRateLimitForTests,
} from "@/infrastructure/auth/rate-limit";
import { resolveAuthFeatureFlags } from "@/infrastructure/auth/types";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";

describe("authorization", () => {
  it("bloque l'accès administration aux non-RH", () => {
    expect(isRouteAllowedForRole("/administration", "manager")).toBe(false);
    expect(isRouteAllowedForRole("/administration", "admin_rh")).toBe(true);
  });

  it("restreint l'accès fiche employé", () => {
    const lea = testSessionFor("emp-lea", "collaborateur");
    const julien = testSessionFor("emp-julien", "manager");
    const other = employees.find((e) => e.id === "emp-camille")!;

    expect(canAccessEmployeeRecord(lea, lea.employee)).toBe(true);
    expect(canAccessEmployeeRecord(lea, other)).toBe(false);
    expect(
      canAccessEmployeeRecord(
        julien,
        employees.find((e) => e.id === "emp-lea")!,
      ),
    ).toBe(true);
  });

  it("refuse requireRole hors périmètre", () => {
    const lea = testSessionFor("emp-lea", "collaborateur");
    expect(() => requireRole(lea, "admin_rh")).toThrow(AuthError);
  });
});

describe("credentials helpers", () => {
  it("hash / verify password", async () => {
    const hash = await hashPassword("Secret-Demo-123!");
    expect(hash).not.toContain("Secret-Demo-123!");
    expect(await verifyPassword("Secret-Demo-123!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("rate-limit login attempts", () => {
    resetLoginRateLimitForTests();
    for (let i = 0; i < 8; i += 1) {
      assertLoginRateLimit("login:test@example.com");
    }
    expect(() => assertLoginRateLimit("login:test@example.com")).toThrow(
      /Trop de tentatives/i,
    );
  });

  it("resolve auth feature flags", () => {
    expect(
      resolveAuthFeatureFlags({ ASTER_CREDENTIALS_AUTH: "0" }).credentialsEnabled,
    ).toBe(false);
    expect(
      resolveAuthFeatureFlags({
        ASTER_ENTRA_AUTH: "1",
        AUTH_MICROSOFT_ENTRA_ID_ID: "id",
        AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret",
        AUTH_MICROSOFT_ENTRA_ID_ISSUER:
          "https://login.microsoftonline.com/tenant/v2.0",
      }).entraEnabled,
    ).toBe(true);
    expect(
      resolveAuthFeatureFlags({ ASTER_ENTRA_AUTH: "1" }).entraEnabled,
    ).toBe(false);
  });
});
