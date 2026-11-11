import { hashPassword } from "@/infrastructure/auth/password";
import {
  upsertMemoryAccount,
  type StoredUserAccount,
} from "@/infrastructure/auth/account-store";
import { getDemoStore } from "@/infrastructure/persistence/demo-store";
import { resolvePersistenceMode } from "@/infrastructure/persistence/persistence-mode";

const SEED_ACCOUNTS: Array<{
  id: string;
  email: string;
  employeeId: string;
  role: StoredUserAccount["role"];
}> = [
  {
    id: "user-lea",
    email: "imane.chraibi@demo.aster-rh.local",
    employeeId: "emp-lea",
    role: "collaborateur",
  },
  {
    id: "user-julien",
    email: "youssef.alaoui@demo.aster-rh.local",
    employeeId: "emp-julien",
    role: "chef_de_projet",
  },
  {
    id: "user-camille",
    email: "sara.benali@demo.aster-rh.local",
    employeeId: "emp-camille",
    role: "admin_rh",
  },
];

let seedInFlight: Promise<void> | null = null;

export function resetMemorySeedAccountsForTests(): void {
  seedInFlight = null;
}

/**
 * Provisionne les comptes démo credentials en mémoire lorsque
 * `ASTER_SEED_PASSWORD` est défini (login local / Playwright E2E).
 * Idempotent ; no-op hors mode mémoire ou sans mot de passe seed.
 */
export async function ensureMemoryDemoCredentialAccounts(): Promise<void> {
  const seedPassword = process.env.ASTER_SEED_PASSWORD?.trim();
  if (!seedPassword) return;

  try {
    if (resolvePersistenceMode() !== "memory") return;
  } catch {
    return;
  }

  const store = getDemoStore();
  const already =
    store.accounts.some(
      (a) => a.id === "user-camille" && Boolean(a.passwordHash),
    ) || false;
  if (already) return;

  if (!seedInFlight) {
    seedInFlight = (async () => {
      const passwordHash = await hashPassword(seedPassword);
      for (const account of SEED_ACCOUNTS) {
        upsertMemoryAccount({
          id: account.id,
          email: account.email,
          passwordHash,
          authProvider: "credentials",
          externalSubject: null,
          role: account.role,
          employeeId: account.employeeId,
          isActive: true,
          mustChangePassword: false,
        });
      }
    })().finally(() => {
      seedInFlight = null;
    });
  }
  await seedInFlight;
}
