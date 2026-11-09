import {
  assertDocumentStorageKeyOwnsRequest,
  assertDocumentUploadFile,
  buildEmployeeDocumentStorageKey,
  canEmployeeAccessOwnDocuments,
  canTransitionDocumentRequest,
  documentRequestTypeLabel,
  isDocumentTypeOfferedToEmployee,
  OPEN_DOCUMENT_REQUEST_STATUSES,
} from "@/domain/rules/document-requests";
import {
  canProcessDocumentRequests,
  canViewAllDocumentRequests,
  hasPermission,
} from "@/domain/rules/permissions";
import type {
  DocumentRequest,
  DocumentRequestStatus,
  DocumentRequestType,
} from "@/domain/types/hr";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { EmailPort } from "@/infrastructure/email/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";

export type CreateDocumentRequestInput = {
  documentType: DocumentRequestType;
  customLabel?: string | null;
  reason: string;
  /** Ignoré — la demande est toujours créée pour le collaborateur authentifié. */
  employeeId?: string;
};

async function notifyHrProcessors(
  deps: { hr: HrRepository; email: EmailPort },
  title: string,
  body: string,
  href: string,
) {
  const { findAccountByEmployeeId } = await import(
    "@/infrastructure/auth/account-store"
  );
  const emps = await deps.hr.listEmployees({ employmentStatus: "actif" });
  for (const recipient of emps) {
    const account = await findAccountByEmployeeId(recipient.id);
    if (
      account?.role !== "admin_rh" &&
      account?.role !== "chef_de_projet" &&
      recipient.id !== "emp-camille" &&
      recipient.id !== "emp-julien"
    ) {
      continue;
    }
    await deps.hr.addNotification({
      recipientId: recipient.id,
      title,
      body,
      href,
      read: false,
      createdAt: new Date().toISOString(),
    });
    await deps.email.send({
      to: recipient.email,
      subject: `[ASTER] ${title}`,
      body,
    });
  }
}

async function notifyEmployeeOnce(
  deps: { hr: HrRepository; email: EmailPort },
  employeeId: string,
  title: string,
  body: string,
  href: string,
  dedupeKind: string,
) {
  const existing = await deps.hr.listNotifications(employeeId);
  const duplicate = existing.some(
    (n) =>
      n.href === href &&
      n.title === title &&
      // fenêtre courte : évite les doubles clics
      Date.now() - new Date(n.createdAt).getTime() < 60_000,
  );
  if (duplicate) return;
  void dedupeKind;
  await deps.hr.addNotification({
    recipientId: employeeId,
    title,
    body,
    href,
    read: false,
    createdAt: new Date().toISOString(),
  });
  const emp = await deps.hr.getEmployee(employeeId);
  if (emp) {
    await deps.email.send({
      to: emp.email,
      subject: `[ASTER] ${title}`,
      body,
    });
  }
}

function toEmployeeView(request: DocumentRequest): DocumentRequest {
  return {
    ...request,
    hrInternalNote: null,
  };
}

export function createDocumentRequestService(deps: {
  hr: HrRepository;
  email: EmailPort;
  storage: DocumentStoragePort;
}) {
  return {
    async create(session: AuthSession, input: CreateDocumentRequestInput) {
      requireSession(session);
      if (!hasPermission(session.role, "document_request.submit")) {
        throw new AuthError("Soumission de demande documentaire refusée.", 403);
      }
      if (!canEmployeeAccessOwnDocuments(session.employee)) {
        throw new AuthError(
          "Compte inactif : les demandes documentaires ne sont plus disponibles.",
          403,
        );
      }
      if (input.employeeId && input.employeeId !== session.employee.id) {
        throw new AuthError(
          "Vous ne pouvez créer une demande que pour votre propre compte.",
          403,
        );
      }

      const reason = input.reason.trim();
      if (reason.length < 5) {
        throw new Error("Indiquez le motif ou l'usage prévu (5 caractères min.).");
      }

      if (!isDocumentTypeOfferedToEmployee(input.documentType, session.employee)) {
        throw new Error(
          "Ce type de document n'est pas proposé pour votre situation.",
        );
      }

      let customLabel: string | null = null;
      if (input.documentType === "autre") {
        customLabel = input.customLabel?.trim() || null;
        if (!customLabel) {
          throw new Error(
            "Précisez le document demandé (revue RH requise).",
          );
        }
      }

      const open = await deps.hr.listDocumentRequests({
        employeeId: session.employee.id,
        documentType: input.documentType,
      });
      const hasOpen = open.some((r) => OPEN_DOCUMENT_REQUEST_STATUSES.has(r.status));
      if (hasOpen) {
        throw new Error(
          "Une demande ouverte existe déjà pour ce type de document.",
        );
      }

      const created = await deps.hr.createDocumentRequest({
        employeeId: session.employee.id,
        documentType: input.documentType,
        customLabel,
        reason,
        status: "en_attente",
        hrMessage: null,
        hrInternalNote: null,
        storageKey: null,
        fileName: null,
        contentType: null,
        published: false,
        publishedAt: null,
        processedByEmployeeId: null,
      });

      await deps.hr.addDocumentRequestEvent({
        requestId: created.id,
        kind: "submitted",
        message: `Demande soumise : ${documentRequestTypeLabel(created.documentType)}`,
        actorId: session.employee.id,
      });

      await notifyEmployeeOnce(
        deps,
        session.employee.id,
        "Demande documentaire enregistrée",
        `Votre demande « ${documentRequestTypeLabel(created.documentType)} » a été transmise aux RH.`,
        "/documents",
        "submitted",
      );

      await notifyHrProcessors(
        deps,
        "Nouvelle demande documentaire",
        `${session.employee.firstName} ${session.employee.lastName} a demandé : ${documentRequestTypeLabel(created.documentType)}.`,
        `/administration/documents/${created.id}`,
      );

      return toEmployeeView(created);
    },

    async listForEmployee(session: AuthSession) {
      requireSession(session);
      if (!hasPermission(session.role, "document_request.view_own")) {
        throw new AuthError("Accès aux demandes documentaires refusé.", 403);
      }
      if (!canEmployeeAccessOwnDocuments(session.employee)) {
        return [];
      }
      const rows = await deps.hr.listDocumentRequests({
        employeeId: session.employee.id,
      });
      return rows.map(toEmployeeView);
    },

    async listForHr(
      session: AuthSession,
      filter?: {
        status?: DocumentRequestStatus | DocumentRequestStatus[];
        documentType?: DocumentRequestType;
        q?: string;
      },
    ) {
      requireSession(session);
      if (!canViewAllDocumentRequests(session.role)) {
        throw new AuthError("File RH des demandes documentaires réservée.", 403);
      }
      return deps.hr.listDocumentRequests(filter);
    },

    async getVisible(session: AuthSession, id: string) {
      requireSession(session);
      const request = await deps.hr.getDocumentRequest(id);
      if (!request) throw new AuthError("Demande introuvable.", 404);

      if (canViewAllDocumentRequests(session.role)) {
        return request;
      }
      if (
        hasPermission(session.role, "document_request.view_own") &&
        request.employeeId === session.employee.id &&
        canEmployeeAccessOwnDocuments(session.employee)
      ) {
        return toEmployeeView(request);
      }
      throw new AuthError("Accès à cette demande refusé.", 403);
    },

    async markProcessing(session: AuthSession, id: string) {
      requireSession(session);
      if (!canProcessDocumentRequests(session.role)) {
        throw new AuthError("Traitement réservé aux RH / Chef de projet.", 403);
      }
      const existing = await deps.hr.getDocumentRequest(id);
      if (!existing) throw new AuthError("Demande introuvable.", 404);
      if (existing.status === "en_traitement") {
        return existing;
      }
      if (!canTransitionDocumentRequest(existing.status, "en_traitement")) {
        throw new Error("Transition vers « En traitement » impossible.");
      }
      const updated = await deps.hr.updateDocumentRequest(id, {
        status: "en_traitement",
        processedByEmployeeId: session.employee.id,
      });
      await deps.hr.addDocumentRequestEvent({
        requestId: id,
        kind: "processing",
        message: "Demande prise en traitement",
        actorId: session.employee.id,
      });
      return updated;
    },

    async requestClarification(
      session: AuthSession,
      id: string,
      message: string,
      internalNote?: string | null,
    ) {
      requireSession(session);
      if (!canProcessDocumentRequests(session.role)) {
        throw new AuthError("Action réservée aux RH / Chef de projet.", 403);
      }
      const text = message.trim();
      if (text.length < 5) {
        throw new Error("Précisez la clarification demandée.");
      }
      const existing = await deps.hr.getDocumentRequest(id);
      if (!existing) throw new AuthError("Demande introuvable.", 404);
      if (
        !canTransitionDocumentRequest(existing.status, "informations_demandees")
      ) {
        throw new Error("Impossible de demander des informations dans cet état.");
      }
      const updated = await deps.hr.updateDocumentRequest(id, {
        status: "informations_demandees",
        hrMessage: text,
        hrInternalNote:
          internalNote?.trim() || existing.hrInternalNote || null,
        processedByEmployeeId: session.employee.id,
      });
      await deps.hr.addDocumentRequestEvent({
        requestId: id,
        kind: "clarification",
        message: text,
        actorId: session.employee.id,
      });
      await notifyEmployeeOnce(
        deps,
        existing.employeeId,
        "Informations demandées sur votre document",
        text,
        "/documents",
        "clarification",
      );
      return updated;
    },

    async reject(
      session: AuthSession,
      id: string,
      reason: string,
      internalNote?: string | null,
    ) {
      requireSession(session);
      if (!canProcessDocumentRequests(session.role)) {
        throw new AuthError("Action réservée aux RH / Chef de projet.", 403);
      }
      const text = reason.trim();
      if (text.length < 5) {
        throw new Error("Indiquez le motif de refus.");
      }
      const existing = await deps.hr.getDocumentRequest(id);
      if (!existing) throw new AuthError("Demande introuvable.", 404);
      if (!canTransitionDocumentRequest(existing.status, "refusee")) {
        throw new Error("Refus impossible dans cet état.");
      }
      const updated = await deps.hr.updateDocumentRequest(id, {
        status: "refusee",
        hrMessage: text,
        hrInternalNote:
          internalNote?.trim() || existing.hrInternalNote || null,
        processedByEmployeeId: session.employee.id,
      });
      await deps.hr.addDocumentRequestEvent({
        requestId: id,
        kind: "rejected",
        message: text,
        actorId: session.employee.id,
      });
      await notifyEmployeeOnce(
        deps,
        existing.employeeId,
        "Demande documentaire refusée",
        text,
        "/documents",
        "rejected",
      );
      return updated;
    },

    async uploadDocument(
      session: AuthSession,
      id: string,
      file: { fileName: string; contentType: string; bytes: Uint8Array },
      internalNote?: string | null,
    ) {
      requireSession(session);
      if (!canProcessDocumentRequests(session.role)) {
        throw new AuthError("Upload réservé aux RH / Chef de projet.", 403);
      }
      const existing = await deps.hr.getDocumentRequest(id);
      if (!existing) throw new AuthError("Demande introuvable.", 404);
      if (
        existing.status === "refusee" ||
        existing.status === "document_disponible"
      ) {
        throw new Error("Impossible d'uploader un fichier dans cet état.");
      }
      const check = assertDocumentUploadFile({
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.bytes.byteLength,
      });
      if (!check.ok) throw new Error(check.message);

      const key = buildEmployeeDocumentStorageKey(
        existing.employeeId,
        existing.id,
        file.fileName,
      );
      const ownership = assertDocumentStorageKeyOwnsRequest(
        key,
        existing.employeeId,
        existing.id,
      );
      if (!ownership.ok) throw new Error(ownership.message);

      await deps.storage.putObject(key, file.bytes, file.contentType);

      const nextStatus: DocumentRequestStatus =
        existing.status === "en_attente" ? "en_traitement" : existing.status;

      const updated = await deps.hr.updateDocumentRequest(id, {
        storageKey: key,
        fileName: file.fileName,
        contentType: file.contentType,
        published: false,
        publishedAt: null,
        status: nextStatus,
        hrInternalNote:
          internalNote?.trim() || existing.hrInternalNote || null,
        processedByEmployeeId: session.employee.id,
      });
      await deps.hr.addDocumentRequestEvent({
        requestId: id,
        kind: "uploaded",
        message: `Fichier déposé (non publié) : ${file.fileName}`,
        actorId: session.employee.id,
      });
      return updated;
    },

    async publish(session: AuthSession, id: string) {
      requireSession(session);
      if (!canProcessDocumentRequests(session.role)) {
        throw new AuthError(
          "Publication réservée aux RH / Chef de projet.",
          403,
        );
      }
      const existing = await deps.hr.getDocumentRequest(id);
      if (!existing) throw new AuthError("Demande introuvable.", 404);
      if (!existing.storageKey || !existing.fileName) {
        throw new Error("Déposez un fichier avant de le mettre à disposition.");
      }
      const ownership = assertDocumentStorageKeyOwnsRequest(
        existing.storageKey,
        existing.employeeId,
        existing.id,
      );
      if (!ownership.ok) throw new Error(ownership.message);
      if (existing.published && existing.status === "document_disponible") {
        return existing;
      }
      if (
        !canTransitionDocumentRequest(existing.status, "document_disponible")
      ) {
        throw new Error("Publication impossible dans cet état.");
      }

      const updated = await deps.hr.updateDocumentRequest(id, {
        status: "document_disponible",
        published: true,
        publishedAt: new Date().toISOString(),
        processedByEmployeeId: session.employee.id,
      });
      await deps.hr.addDocumentRequestEvent({
        requestId: id,
        kind: "published",
        message: "Document mis à disposition du collaborateur",
        actorId: session.employee.id,
      });
      await notifyEmployeeOnce(
        deps,
        existing.employeeId,
        "Document disponible",
        `Votre document « ${documentRequestTypeLabel(existing.documentType)} » est disponible au téléchargement.`,
        "/documents",
        "published",
      );
      return updated;
    },

    async getDownloadUrl(session: AuthSession, id: string) {
      requireSession(session);
      const request = await deps.hr.getDocumentRequest(id);
      if (!request) throw new AuthError("Demande introuvable.", 404);
      if (!request.storageKey) {
        throw new Error("Aucun fichier associé.");
      }
      const ownership = assertDocumentStorageKeyOwnsRequest(
        request.storageKey,
        request.employeeId,
        request.id,
      );
      if (!ownership.ok) throw new Error(ownership.message);

      const isHr = canProcessDocumentRequests(session.role);
      const isOwner =
        request.employeeId === session.employee.id &&
        hasPermission(session.role, "document_request.view_own");

      if (isHr) {
        return deps.storage.getDownloadUrl(request.storageKey, 120);
      }
      if (!isOwner) {
        throw new AuthError("Téléchargement non autorisé.", 403);
      }
      if (!canEmployeeAccessOwnDocuments(session.employee)) {
        throw new AuthError(
          "Accès documents révoqué pour un compte inactif ou parti.",
          403,
        );
      }
      if (!request.published || request.status !== "document_disponible") {
        throw new AuthError(
          "Le document n'est pas encore mis à disposition.",
          403,
        );
      }
      return deps.storage.getDownloadUrl(request.storageKey, 120);
    },

    async listPublishedLibrary(session: AuthSession) {
      requireSession(session);
      if (!canEmployeeAccessOwnDocuments(session.employee)) {
        return [];
      }
      const rows = await deps.hr.listDocumentRequests({
        employeeId: session.employee.id,
        status: "document_disponible",
      });
      return rows.filter((r) => r.published).map(toEmployeeView);
    },
  };
}
