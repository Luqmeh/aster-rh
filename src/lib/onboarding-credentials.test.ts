import { describe, expect, it } from "vitest";
import {
  canSubmitOnboardForm,
  credentialsFromOnboardResult,
  formatCredentialsForCopy,
} from "@/lib/onboarding-credentials";

describe("onboarding-credentials helpers", () => {
  it("expose les identifiants uniquement en cas de succès avec mot de passe", () => {
    expect(
      credentialsFromOnboardResult({
        employeeId: "emp-1",
        email: "a@demo.aster-rh.local",
        temporaryPassword: "Aster-temp",
      }),
    ).toEqual({
      employeeId: "emp-1",
      email: "a@demo.aster-rh.local",
      temporaryPassword: "Aster-temp",
    });
  });

  it("n'expose aucun identifiant si la création échoue (pas de mot de passe)", () => {
    expect(
      credentialsFromOnboardResult({
        employeeId: "emp-1",
        email: "a@demo.aster-rh.local",
        temporaryPassword: null,
      }),
    ).toBeNull();
  });

  it("formate le presse-papiers e-mail + mot de passe", () => {
    expect(
      formatCredentialsForCopy({
        employeeId: "emp-1",
        email: "a@demo.aster-rh.local",
        temporaryPassword: "Aster-temp",
      }),
    ).toContain("E-mail : a@demo.aster-rh.local");
  });

  it("empêche les soumissions pendant pending ou tant que la modale est visible", () => {
    expect(canSubmitOnboardForm({ pending: true, credentialsVisible: false })).toBe(
      false,
    );
    expect(
      canSubmitOnboardForm({ pending: false, credentialsVisible: true }),
    ).toBe(false);
    expect(
      canSubmitOnboardForm({ pending: false, credentialsVisible: false }),
    ).toBe(true);
  });
});
