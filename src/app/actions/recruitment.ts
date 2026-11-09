"use server";

import { revalidatePath } from "next/cache";
import {
  createRecruitmentService,
  type RecruitmentDraftInput,
} from "@/application/services/recruitment-service";
import { canDecideRecruitment } from "@/domain/rules/permissions";
import { MAX_CV_BYTES } from "@/domain/rules/recruitment";
import { AuthError } from "@/infrastructure/auth/authorization";
import { requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

type ActionOk = { ok: true };
type ActionFail = { ok: false; message: string };
type ActionResult = ActionOk | ActionFail;

function revalidateRecruitment(id?: string) {
  revalidatePath("/entretiens");
  revalidatePath("/notifications");
  revalidatePath("/tableau-de-bord");
  if (id) revalidatePath(`/entretiens/${id}`);
}

function toActionError(error: unknown, fallback: string): ActionFail {
  if (error instanceof AuthError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof Error && error.message.trim()) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: fallback };
}

export async function createRecruitmentDraftAction(
  input: RecruitmentDraftInput,
): Promise<ActionResult & { id?: string }> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createRecruitmentService(container);
    const candidate = await service.createDraft(session, input);
    revalidateRecruitment(candidate.id);
    return { ok: true, id: candidate.id };
  } catch (error) {
    return toActionError(error, "Création du dossier impossible.");
  }
}

export async function updateRecruitmentDraftAction(
  id: string,
  input: RecruitmentDraftInput,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createRecruitmentService(container);
    await service.updateDraft(session, id, input);
    revalidateRecruitment(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Enregistrement impossible.");
  }
}

/**
 * Upload CV via FormData (fichier natif) — évite les payloads base64 fragiles
 * et remonte une erreur métier lisible au lieu d'un throw → React #441.
 */
export async function uploadRecruitmentCvAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const id = String(formData.get("candidateId") ?? "").trim();
    const file = formData.get("cv");
    if (!id) {
      return { ok: false, message: "Dossier candidat manquant." };
    }
    if (!(file instanceof File)) {
      return { ok: false, message: "Sélectionnez un fichier CV." };
    }
    if (file.size <= 0) {
      return { ok: false, message: "Le fichier CV est vide." };
    }
    if (file.size > MAX_CV_BYTES) {
      return {
        ok: false,
        message: "La taille du CV doit être inférieure à 5 Mo.",
      };
    }

    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createRecruitmentService(container);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await service.uploadCv(session, id, {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      bytes,
    });
    revalidateRecruitment(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Téléversement du CV impossible.");
  }
}

export async function submitRecruitmentAction(
  id: string,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createRecruitmentService(container);
    await service.submit(session, id);
    revalidateRecruitment(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Soumission impossible.");
  }
}

export async function decideRecruitmentAction(
  id: string,
  decision: "approuve" | "refuse",
  comment?: string,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    if (!canDecideRecruitment(session.role)) {
      return {
        ok: false,
        message:
          "Seuls les Chefs de projet peuvent approuver ou refuser un recrutement.",
      };
    }
    const service = createRecruitmentService(container);
    await service.decide(session, id, decision, comment);
    revalidateRecruitment(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Décision impossible.");
  }
}

export async function applyInterviewerAssignmentAction(
  id: string,
  interviewerEmployeeId: string,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createRecruitmentService(container);
    await service.assignInterviewer(session, id, interviewerEmployeeId);
    revalidateRecruitment(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Assignation impossible.");
  }
}

export async function getRecruitmentCvUrlAction(
  id: string,
): Promise<(ActionOk & { url: string }) | ActionFail> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createRecruitmentService(container);
    const url = await service.getCvDownloadUrl(session, id);
    return { ok: true, url };
  } catch (error) {
    return toActionError(error, "Accès CV impossible.");
  }
}
