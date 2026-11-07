import { cookies } from "next/headers";
import { demoIdentities, employees } from "@/data/demo-seed";
import type { AuthPort, AuthSession } from "@/infrastructure/auth/types";

export const DEMO_IDENTITY_COOKIE = "aster_demo_identity";
const DEFAULT_IDENTITY = "demo-collab";

function buildSession(identityId: string): AuthSession {
  const identity =
    demoIdentities.find((item) => item.id === identityId) ??
    demoIdentities.find((item) => item.id === DEFAULT_IDENTITY)!;
  const employee = employees.find((item) => item.id === identity.employeeId);
  if (!employee) {
    throw new Error("Identité de démonstration inconsistante.");
  }
  return {
    isDemo: true,
    identity,
    employee,
    role: identity.role,
  };
}

export const demoAuth: AuthPort = {
  async getSession() {
    const jar = await cookies();
    const identityId = jar.get(DEMO_IDENTITY_COOKIE)?.value ?? DEFAULT_IDENTITY;
    return buildSession(identityId);
  },

  async switchDemoIdentity(identityId: string) {
    const exists = demoIdentities.some((item) => item.id === identityId);
    if (!exists) {
      throw new Error("Identité de démonstration inconnue.");
    }
    const jar = await cookies();
    jar.set(DEMO_IDENTITY_COOKIE, identityId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Cookie de session démo — pas un jeton de sécurité production.
      maxAge: 60 * 60 * 24 * 7,
    });
    return buildSession(identityId);
  },

  async listDemoIdentities() {
    return demoIdentities;
  },

  async signIn() {
    throw new Error(
      "L'authentification Microsoft Entra ID n'est pas activée en mode démonstration.",
    );
  },

  async signOut() {
    const jar = await cookies();
    jar.delete(DEMO_IDENTITY_COOKIE);
  },
};
