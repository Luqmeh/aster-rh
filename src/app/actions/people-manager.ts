"use server";

import { createPeopleManagerService } from "@/application/services/people-manager-service";
import { getContainer } from "@/infrastructure/container";

export async function createPeopleManagerAction(input: {
  displayName: string;
  linkedEmployeeId?: string | null;
}) {
  const { auth, hr } = getContainer();
  const session = await auth.getSession();
  if (!session) throw new Error("Session absente");
  const service = createPeopleManagerService({ hr });
  return service.create(session, input);
}

export async function listPeopleManagersAction(includeInactive = false) {
  const { auth, hr } = getContainer();
  const session = await auth.getSession();
  if (!session) throw new Error("Session absente");
  const service = createPeopleManagerService({ hr });
  return service.list(session, { includeInactive });
}
