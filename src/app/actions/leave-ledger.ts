"use server";

import { revalidatePath } from "next/cache";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import type { LeaveLedgerAccount } from "@/domain/types/leave-ledger";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

export async function adjustLeaveBalanceAction(input: {
  employeeId: string;
  account: LeaveLedgerAccount;
  quantity: number;
  effectiveDate: string;
  reason: string;
  year?: number;
}) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const ledger = createLeaveLedgerService(container);
  try {
    const entry = await ledger.adjustBalance(session, input);
    revalidatePath("/conges");
    revalidatePath("/administration");
    revalidatePath(`/annuaire/${input.employeeId}`);
    return { ok: true as const, entryId: entry.id };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw error instanceof Error
      ? error
      : new Error("Ajustement impossible.");
  }
}
