"use server";

import { revalidatePath } from "next/cache";
import {
  createEmployeeProvisioningService,
  type OnboardEmployeeInput,
} from "@/application/services/employee-provisioning-service";
import type { DemoRole, EmploymentStatus } from "@/domain/types/hr";
import { requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

function revalidatePeople(employeeId?: string) {
  revalidatePath("/annuaire");
  revalidatePath("/administration");
  if (employeeId) revalidatePath(`/annuaire/${employeeId}`);
}

export async function onboardEmployeeAction(input: OnboardEmployeeInput) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createEmployeeProvisioningService(container);
  const result = await service.onboard(session, input);
  revalidatePeople(result.employee.id);
  return {
    ok: true as const,
    employeeId: result.employee.id,
    temporaryPassword: result.temporaryPassword,
  };
}

export async function changeEmploymentStatusAction(
  employeeId: string,
  status: EmploymentStatus,
  options?: { departureDate?: string; departureNote?: string },
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createEmployeeProvisioningService(container);
  await service.changeLifecycle(session, employeeId, status, options);
  revalidatePeople(employeeId);
  return { ok: true as const };
}

export async function changeAccountRoleAction(
  employeeId: string,
  role: DemoRole,
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createEmployeeProvisioningService(container);
  await service.changeRole(session, employeeId, role);
  revalidatePeople(employeeId);
  return { ok: true as const };
}

export async function reprovisionTemporaryPasswordAction(employeeId: string) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createEmployeeProvisioningService(container);
  const result = await service.reprovisionTemporaryPassword(
    session,
    employeeId,
  );
  revalidatePeople(employeeId);
  return {
    ok: true as const,
    employeeId: result.employeeId,
    email: result.email,
    temporaryPassword: result.temporaryPassword,
  };
}
