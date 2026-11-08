import type { DemoRole } from "@/domain/types/hr";
import type { AuthProviderKind } from "@/infrastructure/auth/types";
import { getPrismaClient } from "@/infrastructure/persistence/prisma-client";
import { resolvePersistenceMode } from "@/infrastructure/persistence/persistence-mode";
import { applyPrismaDatabaseEnvFallbacks } from "@/infrastructure/persistence/database-env";

export type StoredUserAccount = {
  id: string;
  email: string;
  passwordHash: string | null;
  authProvider: AuthProviderKind;
  externalSubject: string | null;
  role: DemoRole;
  employeeId: string;
  isActive: boolean;
};

/** Compte seed en mémoire lorsque la persistance Prisma n'est pas disponible (tests / build). */
const memoryAccounts = new Map<string, StoredUserAccount>();

export function resetMemoryAccountsForTests(): void {
  memoryAccounts.clear();
}

export function upsertMemoryAccount(account: StoredUserAccount): void {
  memoryAccounts.set(account.email.toLowerCase(), account);
}

async function shouldUsePrisma(): Promise<boolean> {
  try {
    applyPrismaDatabaseEnvFallbacks();
    return resolvePersistenceMode() === "prisma";
  } catch {
    return false;
  }
}

export async function findAccountByEmail(
  email: string,
): Promise<StoredUserAccount | null> {
  const normalized = email.trim().toLowerCase();
  if (await shouldUsePrisma()) {
    const row = await getPrismaClient().userAccount.findUnique({
      where: { email: normalized },
    });
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      authProvider: row.authProvider,
      externalSubject: row.externalSubject,
      role: row.role,
      employeeId: row.employeeId,
      isActive: row.isActive,
    };
  }
  return memoryAccounts.get(normalized) ?? null;
}

export async function findAccountByExternalSubject(
  subject: string,
): Promise<StoredUserAccount | null> {
  if (await shouldUsePrisma()) {
    const row = await getPrismaClient().userAccount.findFirst({
      where: { authProvider: "entra_id", externalSubject: subject },
    });
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      authProvider: row.authProvider,
      externalSubject: row.externalSubject,
      role: row.role,
      employeeId: row.employeeId,
      isActive: row.isActive,
    };
  }
  for (const account of memoryAccounts.values()) {
    if (
      account.authProvider === "entra_id" &&
      account.externalSubject === subject
    ) {
      return account;
    }
  }
  return null;
}

export async function findAccountById(
  id: string,
): Promise<StoredUserAccount | null> {
  if (await shouldUsePrisma()) {
    const row = await getPrismaClient().userAccount.findUnique({
      where: { id },
    });
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      authProvider: row.authProvider,
      externalSubject: row.externalSubject,
      role: row.role,
      employeeId: row.employeeId,
      isActive: row.isActive,
    };
  }
  for (const account of memoryAccounts.values()) {
    if (account.id === id) return account;
  }
  return null;
}

export async function touchLastLogin(accountId: string): Promise<void> {
  if (await shouldUsePrisma()) {
    await getPrismaClient().userAccount.update({
      where: { id: accountId },
      data: { lastLoginAt: new Date() },
    });
  }
}
