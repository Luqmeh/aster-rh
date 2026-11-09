"use server";

import { revalidatePath } from "next/cache";
import { createWorkAbsenceService } from "@/application/services/work-absence-service";
import type { DeclareWorkAbsenceInput } from "@/domain/rules/work-absence";
import type {
  AbsenceDocumentKind,
  WorkAbsenceStatus,
} from "@/domain/types/hr";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

type ActionOk = { ok: true; id?: string };
type ActionFail = { ok: false; message: string };
type ActionResult = ActionOk | ActionFail;

function revalidateAbsence(id?: string) {
  revalidatePath("/absences");
  revalidatePath("/conges");
  revalidatePath("/administration/absences");
  revalidatePath("/administration/rapports");
  revalidatePath("/calendrier");
  revalidatePath("/notifications");
  revalidatePath("/tableau-de-bord");
  if (id) {
    revalidatePath(`/administration/absences/${id}`);
    revalidatePath(`/absences/${id}`);
  }
}

function toError(error: unknown, fallback: string): ActionFail {
  if (error instanceof AuthError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof Error && error.message.trim()) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: fallback };
}

function service() {
  const container = getContainer();
  return createWorkAbsenceService({
    hr: container.hr,
    email: container.email,
    storage: container.storage,
  });
}

export async function declareWorkAbsenceAction(
  input: DeclareWorkAbsenceInput,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const created = await service().declare(session, input);
    revalidateAbsence(created.id);
    return { ok: true, id: created.id };
  } catch (error) {
    return toError(error, "Déclaration impossible.");
  }
}

export async function uploadWorkAbsenceDocumentAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const absenceId = String(formData.get("absenceId") ?? "");
    const kind = String(formData.get("kind") ?? "autre") as AbsenceDocumentKind;
    const file = formData.get("file");
    if (!absenceId || !(file instanceof File)) {
      return { ok: false, message: "Fichier ou dossier manquant." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await service().uploadDocument(session, absenceId, {
      kind,
      fileName: file.name || "justificatif.pdf",
      contentType: file.type || "application/octet-stream",
      bytes,
    });
    revalidateAbsence(absenceId);
    return { ok: true, id: absenceId };
  } catch (error) {
    return toError(error, "Upload du justificatif impossible.");
  }
}

export async function hrUpdateWorkAbsenceAction(input: {
  absenceId: string;
  status: WorkAbsenceStatus;
  hrMessage?: string | null;
  hrInternalNote?: string | null;
  rejectionReason?: string | null;
  startDate?: string;
  endDate?: string;
  recurrenceOfId?: string | null;
  parentAbsenceId?: string | null;
  actualReturnDate?: string | null;
  returnVisitPlannedDate?: string | null;
  returnVisitStatus?:
    | "non_applicable"
    | "a_planifier"
    | "planifiee"
    | "realisee"
    | "non_requise";
  markDocumentReceived?: boolean;
}): Promise<ActionResult> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    await service().hrUpdateStatus(session, input.absenceId, input);
    revalidateAbsence(input.absenceId);
    return { ok: true, id: input.absenceId };
  } catch (error) {
    return toError(error, "Mise à jour RH impossible.");
  }
}

export async function getWorkAbsenceDocumentUrlAction(input: {
  absenceId: string;
  documentId: string;
}): Promise<{ ok: true; url: string } | ActionFail> {
  try {
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const url = await service().getDocumentDownloadUrl(
      session,
      input.documentId,
      input.absenceId,
    );
    return { ok: true, url };
  } catch (error) {
    return toError(error, "Téléchargement refusé.");
  }
}
