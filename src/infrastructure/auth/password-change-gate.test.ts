import { describe, expect, it } from "vitest";
import { isAllowedDuringPasswordChange } from "@/infrastructure/auth/password-change-gate";

describe("password-change-gate", () => {
  it("autorise la page de changement et Auth.js", () => {
    expect(isAllowedDuringPasswordChange("/changer-mot-de-passe")).toBe(true);
    expect(isAllowedDuringPasswordChange("/api/auth/session")).toBe(true);
  });

  it("refuse le tableau de bord et les actions métier", () => {
    expect(isAllowedDuringPasswordChange("/tableau-de-bord")).toBe(false);
    expect(isAllowedDuringPasswordChange("/annuaire")).toBe(false);
    expect(isAllowedDuringPasswordChange("/profil")).toBe(false);
  });
});
