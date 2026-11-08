"use server";

import { revalidatePath } from "next/cache";
import {
  createEmployeeService,
  type HrEmployeePatch,
  type PersonalProfilePatch,
} from "@/application/services/employee-service";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

function revalidateEmployeePaths(employeeId: string) {
  revalidatePath("/annuaire");
  revalidatePath(`/annuaire/${employeeId}`);
  revalidatePath("/profil");
  revalidatePath("/tableau-de-bord");
}

export async function updatePersonalProfileAction(
  employeeId: string,
  patch: PersonalProfilePatch,
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createEmployeeService(container);
  const updated = await service.updatePersonal(session, employeeId, patch);
  revalidateEmployeePaths(employeeId);
  return { ok: true as const, id: updated.id };
}

export async function updateEmployeeHrAction(
  employeeId: string,
  patch: HrEmployeePatch,
) {
  const container = getContainer();
  try {
    const session = requireSession(await container.auth.getSession());
    const service = createEmployeeService(container);
    const updated = await service.updateHrRecord(session, employeeId, patch);
    revalidateEmployeePaths(employeeId);
    return { ok: true as const, id: updated.id };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw error;
  }
}
