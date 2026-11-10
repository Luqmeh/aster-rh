import type { DemoRole } from "@/domain/types/hr";
import type { AuthProviderKind } from "@/infrastructure/auth/types";
import { getPrismaClient } from "@/infrastructure/persistence/prisma-client";
import { resolvePersistenceMode } from "@/infrastructure/persistence/persistence-mode";
import { applyPrismaDatabaseEnvFallbacks } from "@/infrastructure/persistence/database-env";
import { getDemoStore } from "@/infrastructure/persistence/demo-store";

export type StoredUserAccount = {
  id: string;
  email: string;
  passwordHash: string | null;
  authProvider: AuthProviderKind;
  externalSubject: string | null;
  role: DemoRole;
  employeeId: string;
  isActive: boolean;
  mustChangePassword: boolean;
};

/** Compte seed en mémoire lorsque la persistance Prisma n'est pas disponible (tests / build). */
const memoryAccounts = new Map<string, StoredUserAccount>();

export function resetMemoryAccountsForTests(): void {
  memoryAccounts.clear();
}

export function upsertMemoryAccount(account: StoredUserAccount): void {
  memoryAccounts.set(account.email.toLowerCase(), account);
  const store = getDemoStore();
  const idx = store.accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) store.accounts[idx] = account;
  else store.accounts.push(account);
}

async function shouldUsePrisma(): Promise<boolean> {
  try {
    applyPrismaDatabaseEnvFallbacks();
    return resolvePersistenceMode() === "prisma";
  } catch {
    return false;
  }
}

function mapAccount(row: {
  id: string;
  email: string;
  passwordHash: string | null;
  authProvider: AuthProviderKind;
  externalSubject: string | null;
  role: DemoRole;
  employeeId: string;
  isActive: boolean;
  mustChangePassword?: boolean;
}): StoredUserAccount {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    authProvider: row.authProvider,
    externalSubject: row.externalSubject,
    role: row.role,
    employeeId: row.employeeId,
    isActive: row.isActive,
    mustChangePassword: Boolean(row.mustChangePassword),
  };
}

function fromMemoryByEmail(email: string): StoredUserAccount | null {
  const normalized = email.trim().toLowerCase();
  const fromMap = memoryAccounts.get(normalized);
  if (fromMap) return fromMap;
  return (
    getDemoStore().accounts.find((a) => a.email.toLowerCase() === normalized) ??
    null
  );
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
    return mapAccount(row);
  }
  return fromMemoryByEmail(normalized);
}

export async function findAccountByEmployeeId(
  employeeId: string,
): Promise<StoredUserAccount | null> {
  if (await shouldUsePrisma()) {
    const row = await getPrismaClient().userAccount.findUnique({
      where: { employeeId },
    });
    if (!row) return null;
    return mapAccount(row);
  }
  const fromStore =
    getDemoStore().accounts.find((a) => a.employeeId === employeeId) ?? null;
  if (fromStore) return fromStore;
  for (const account of memoryAccounts.values()) {
    if (account.employeeId === employeeId) return account;
  }
  return null;
}

export async function findAccountByExternalSubject(
  subject: string,
): Promise<StoredUserAccount | null> {
  if (await shouldUsePrisma()) {
    const row = await getPrismaClient().userAccount.findFirst({
      where: { authProvider: "entra_id", externalSubject: subject },
    });
    if (!row) return null;
    return mapAccount(row);
  }
  for (const account of [
    ...memoryAccounts.values(),
    ...getDemoStore().accounts,
  ]) {
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
    return mapAccount(row);
  }
  for (const account of [
    ...memoryAccounts.values(),
    ...getDemoStore().accounts,
  ]) {
    if (account.id === id) return account;
  }
  return null;
}

export async function createUserAccount(input: {
  id?: string;
  email: string;
  passwordHash: string | null;
  authProvider: AuthProviderKind;
  role: DemoRole;
  employeeId: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}): Promise<StoredUserAccount> {
  const email = input.email.trim().toLowerCase();
  const account: StoredUserAccount = {
    id: input.id ?? `user-${Date.now().toString(36)}`,
    email,
    passwordHash: input.passwordHash,
    authProvider: input.authProvider,
    externalSubject: null,
    role: input.role,
    employeeId: input.employeeId,
    isActive: input.isActive ?? true,
    mustChangePassword: input.mustChangePassword ?? false,
  };

  if (await shouldUsePrisma()) {
    const row = await getPrismaClient().userAccount.create({
      data: {
        id: account.id,
        email: account.email,
        passwordHash: account.passwordHash,
        authProvider: account.authProvider,
        role: account.role,
        employeeId: account.employeeId,
        isActive: account.isActive,
        mustChangePassword: account.mustChangePassword,
      },
    });
    return mapAccount(row);
  }

  if (fromMemoryByEmail(email) || (await findAccountByEmployeeId(account.employeeId))) {
    throw new Error("Compte déjà provisionné pour cet e-mail ou collaborateur.");
  }
  upsertMemoryAccount(account);
  return account;
}

export async function updateUserAccount(
  id: string,
  patch: Partial<
    Pick<
      StoredUserAccount,
      "role" | "isActive" | "passwordHash" | "email" | "mustChangePassword"
    >
  >,
): Promise<StoredUserAccount> {
  if (await shouldUsePrisma()) {
    const row = await getPrismaClient().userAccount.update({
      where: { id },
      data: patch,
    });
    return mapAccount(row);
  }

  const existing = await findAccountById(id);
  if (!existing) throw new Error("Compte introuvable.");
  const updated = { ...existing, ...patch };
  memoryAccounts.delete(existing.email.toLowerCase());
  upsertMemoryAccount(updated);
  return updated;
}

export async function touchLastLogin(accountId: string): Promise<void> {
  if (await shouldUsePrisma()) {
    await getPrismaClient().userAccount.update({
      where: { id: accountId },
      data: { lastLoginAt: new Date() },
    });
  }
}
