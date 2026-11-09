"use server";

import { revalidatePath } from "next/cache";
import {
  createDocumentRequestService,
  type CreateDocumentRequestInput,
} from "@/application/services/document-request-service";
import { MAX_DOCUMENT_REQUEST_BYTES } from "@/domain/rules/document-requests";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

type ActionOk = { ok: true };
type ActionFail = { ok: false; message: string };
type ActionResult = ActionOk | ActionFail;

function revalidateDocs(id?: string) {
  revalidatePath("/documents");
  revalidatePath("/administration");
  revalidatePath("/administration/documents");
  revalidatePath("/notifications");
  revalidatePath("/tableau-de-bord");
  if (id) revalidatePath(`/administration/documents/${id}`);
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

export async function createDocumentRequestAction(
  input: CreateDocumentRequestInput,
): Promise<ActionResult & { id?: string }> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createDocumentRequestService(container);
    const created = await service.create(session, input);
    revalidateDocs(created.id);
    return { ok: true, id: created.id };
  } catch (error) {
    return toActionError(error, "Création de la demande impossible.");
  }
}

export async function markDocumentRequestProcessingAction(
  id: string,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createDocumentRequestService(container);
    await service.markProcessing(session, id);
    revalidateDocs(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Mise en traitement impossible.");
  }
}

export async function requestDocumentClarificationAction(
  id: string,
  message: string,
  internalNote?: string,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createDocumentRequestService(container);
    await service.requestClarification(session, id, message, internalNote);
    revalidateDocs(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Demande d'informations impossible.");
  }
}

export async function rejectDocumentRequestAction(
  id: string,
  reason: string,
  internalNote?: string,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createDocumentRequestService(container);
    await service.reject(session, id, reason, internalNote);
    revalidateDocs(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Refus impossible.");
  }
}

export async function uploadDocumentRequestFileAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const id = String(formData.get("requestId") ?? "").trim();
    const internalNote = String(formData.get("hrInternalNote") ?? "").trim();
    const file = formData.get("file");
    if (!id) return { ok: false, message: "Demande manquante." };
    if (!(file instanceof File)) {
      return { ok: false, message: "Sélectionnez un fichier." };
    }
    if (file.size <= 0 || file.size > MAX_DOCUMENT_REQUEST_BYTES) {
      return {
        ok: false,
        message: "La taille du fichier doit être inférieure à 5 Mo.",
      };
    }
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createDocumentRequestService(container);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await service.uploadDocument(
      session,
      id,
      {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        bytes,
      },
      internalNote || null,
    );
    revalidateDocs(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Téléversement impossible.");
  }
}

export async function publishDocumentRequestAction(
  id: string,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createDocumentRequestService(container);
    await service.publish(session, id);
    revalidateDocs(id);
    return { ok: true };
  } catch (error) {
    return toActionError(error, "Mise à disposition impossible.");
  }
}

export async function getDocumentRequestDownloadUrlAction(
  id: string,
): Promise<(ActionOk & { url: string }) | ActionFail> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createDocumentRequestService(container);
    const url = await service.getDownloadUrl(session, id);
    return { ok: true, url };
  } catch (error) {
    return toActionError(error, "Téléchargement impossible.");
  }
}
