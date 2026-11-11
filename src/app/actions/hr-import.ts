"use server";

import { createHrImportService } from "@/application/services/hr-import-service";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";
import { revalidatePath } from "next/cache";

type ActionOk = {
  ok: true;
  batchId?: string;
  fileName?: string;
  base64?: string;
};
type ActionFail = { ok: false; message: string };
export type HrImportActionResult = ActionOk | ActionFail;

function service() {
  const container = getContainer();
  return createHrImportService({
    hr: container.hr,
    storage: container.storage,
    email: container.email,
  });
}

async function sessionOrThrow() {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  return { session, importService: service() };
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

function revalidateImport() {
  revalidatePath("/administration/import-collaborateurs");
}

/**
 * Les erreurs métier sont renvoyées en `{ ok: false }` (pas de throw) pour
 * éviter le masquage production « Minified React error #441 ».
 */
export async function downloadHrImportTemplateAction(): Promise<HrImportActionResult> {
  try {
    const { session, importService } = await sessionOrThrow();
    const { buffer, fileName } = await importService.downloadTemplate(session);
    return {
      ok: true,
      fileName,
      base64: Buffer.from(buffer).toString("base64"),
    };
  } catch (error) {
    return toError(error, "Téléchargement du modèle impossible.");
  }
}

export async function downloadHrImportReportAction(
  batchId: string,
): Promise<HrImportActionResult> {
  try {
    const { session, importService } = await sessionOrThrow();
    const { buffer, fileName } = await importService.downloadExecutionReport(
      session,
      batchId,
    );
    return {
      ok: true,
      fileName,
      base64: Buffer.from(buffer).toString("base64"),
    };
  } catch (error) {
    return toError(error, "Téléchargement du rapport impossible.");
  }
}

export async function uploadHrImportAction(
  formData: FormData,
): Promise<HrImportActionResult> {
  try {
    const { session, importService } = await sessionOrThrow();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, message: "Fichier manquant." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const batch = await importService.uploadWorkbook(session, {
      fileName: file.name,
      bytes,
    });
    await importService.validateBatch(session, { batchId: batch.id });
    revalidateImport();
    return { ok: true, batchId: batch.id };
  } catch (error) {
    return toError(error, "Analyse du classeur impossible.");
  }
}

export async function validateHrImportAction(
  formData: FormData,
): Promise<HrImportActionResult> {
  try {
    const { session, importService } = await sessionOrThrow();
    const batchId = String(formData.get("batchId") ?? "");
    const updateExisting =
      String(formData.get("updateExisting") ?? "") === "true";
    await importService.validateBatch(session, {
      batchId,
      updateExistingEmployees: updateExisting,
    });
    revalidateImport();
    return { ok: true, batchId };
  } catch (error) {
    return toError(error, "Recalcul de prévisualisation impossible.");
  }
}

export async function executeHrImportAction(
  formData: FormData,
): Promise<HrImportActionResult> {
  try {
    const { session, importService } = await sessionOrThrow();
    const batchId = String(formData.get("batchId") ?? "");
    const confirmationPhrase = String(formData.get("confirmationPhrase") ?? "");
    await importService.confirmAndExecute(session, {
      batchId,
      confirmationPhrase,
    });
    revalidateImport();
    revalidatePath("/annuaire");
    return { ok: true, batchId };
  } catch (error) {
    return toError(
      error,
      "Exécution de l'import impossible.",
    );
  }
}
