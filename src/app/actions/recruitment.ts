"use server";

import { revalidatePath } from "next/cache";
import {
  createRecruitmentService,
  type RecruitmentDraftInput,
} from "@/application/services/recruitment-service";
import { canDecideRecruitment } from "@/domain/rules/permissions";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

function revalidateRecruitment(id?: string) {
  revalidatePath("/entretiens");
  revalidatePath("/notifications");
  revalidatePath("/tableau-de-bord");
  if (id) revalidatePath(`/entretiens/${id}`);
}

export async function createRecruitmentDraftAction(input: RecruitmentDraftInput) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createRecruitmentService(container);
  const candidate = await service.createDraft(session, input);
  revalidateRecruitment(candidate.id);
  return { ok: true as const, id: candidate.id };
}

export async function updateRecruitmentDraftAction(
  id: string,
  input: RecruitmentDraftInput,
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createRecruitmentService(container);
  await service.updateDraft(session, id, input);
  revalidateRecruitment(id);
  return { ok: true as const };
}

export async function uploadRecruitmentCvAction(
  id: string,
  file: { fileName: string; contentType: string; base64: string },
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createRecruitmentService(container);
  const bytes = Uint8Array.from(Buffer.from(file.base64, "base64"));
  await service.uploadCv(session, id, {
    fileName: file.fileName,
    contentType: file.contentType,
    bytes,
  });
  revalidateRecruitment(id);
  return { ok: true as const };
}

export async function submitRecruitmentAction(id: string) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createRecruitmentService(container);
  await service.submit(session, id);
  revalidateRecruitment(id);
  return { ok: true as const };
}

export async function decideRecruitmentAction(
  id: string,
  decision: "approuve" | "refuse",
  comment?: string,
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  if (!canDecideRecruitment(session.role)) {
    throw new AuthError(
      "Seuls les Chefs de projet peuvent approuver ou refuser un recrutement.",
      403,
    );
  }
  const service = createRecruitmentService(container);
  await service.decide(session, id, decision, comment);
  revalidateRecruitment(id);
  return { ok: true as const };
}

export async function applyInterviewerAssignmentAction(
  id: string,
  interviewerEmployeeId: string,
) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createRecruitmentService(container);
  await service.assignInterviewer(session, id, interviewerEmployeeId);
  revalidateRecruitment(id);
  return { ok: true as const };
}

export async function getRecruitmentCvUrlAction(id: string) {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  const service = createRecruitmentService(container);
  const url = await service.getCvDownloadUrl(session, id);
  return { ok: true as const, url };
}
