"use server";

import { createHrImportService } from "@/application/services/hr-import-service";
import { requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";
import { revalidatePath } from "next/cache";

function service() {
  const container = getContainer();
  return createHrImportService({
    hr: container.hr,
    storage: container.storage,
  });
}

async function sessionOrThrow() {
  const container = getContainer();
  const session = requireSession(await container.auth.getSession());
  return { session, importService: service() };
}

export async function downloadHrImportTemplateAction(kind: string) {
  const { session, importService } = await sessionOrThrow();
  const k =
    kind === "balances" ? "balances" : kind === "history" ? "history" : "employees";
  const { buffer } = await importService.downloadTemplate(session, k);
  return {
    fileName: `aster-modele-${k}.xlsx`,
    base64: Buffer.from(buffer).toString("base64"),
  };
}

export async function downloadHrImportReportAction(batchId: string) {
  const { session, importService } = await sessionOrThrow();
  const { buffer, fileName } = await importService.downloadExecutionReport(
    session,
    batchId,
  );
  return {
    fileName,
    base64: Buffer.from(buffer).toString("base64"),
  };
}

export async function uploadHrImportAction(formData: FormData) {
  const { session, importService } = await sessionOrThrow();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Fichier manquant.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const batch = await importService.uploadWorkbook(session, {
    fileName: file.name,
    bytes,
  });
  await importService.validateBatch(session, { batchId: batch.id });
  revalidatePath("/administration/import-collaborateurs");
  return { batchId: batch.id };
}

export async function validateHrImportAction(formData: FormData) {
  const { session, importService } = await sessionOrThrow();
  const batchId = String(formData.get("batchId") ?? "");
  const updateExisting =
    String(formData.get("updateExisting") ?? "") === "true";
  await importService.validateBatch(session, {
    batchId,
    updateExistingEmployees: updateExisting,
  });
  revalidatePath("/administration/import-collaborateurs");
}

export async function executeHrImportAction(formData: FormData) {
  const { session, importService } = await sessionOrThrow();
  const batchId = String(formData.get("batchId") ?? "");
  const confirmationPhrase = String(formData.get("confirmationPhrase") ?? "");
  await importService.confirmAndExecute(session, {
    batchId,
    confirmationPhrase,
  });
  revalidatePath("/administration/import-collaborateurs");
  revalidatePath("/annuaire");
}
