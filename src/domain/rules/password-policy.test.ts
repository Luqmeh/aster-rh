import { describe, expect, it } from "vitest";
import { validateNewPassword } from "@/domain/rules/password-policy";

describe("password-policy", () => {
  it("accepte un mot de passe conforme", () => {
    expect(validateNewPassword("AsterSecure1", "AsterSecure1")).toEqual({
      ok: true,
    });
  });

  it("refuse une confirmation différente", () => {
    const result = validateNewPassword("AsterSecure1", "AsterSecure2");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/confirmation/i);
  });

  it("refuse un mot de passe trop court", () => {
    const result = validateNewPassword("Abc123", "Abc123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/10/);
  });

  it("refuse l'absence de lettre ou chiffre", () => {
    expect(validateNewPassword("abcdefghij", "abcdefghij").ok).toBe(false);
    expect(validateNewPassword("1234567890", "1234567890").ok).toBe(false);
  });

  it("refuse la réutilisation du mot de passe temporaire", () => {
    const result = validateNewPassword("AsterSecure1", "AsterSecure1", {
      currentPassword: "AsterSecure1",
    });
    expect(result.ok).toBe(false);
  });
});
