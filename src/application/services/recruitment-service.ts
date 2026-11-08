import {
  assertCvFile,
  canAssignInterviewerStatus,
  canDecideRecruitmentStatus,
  canEditRecruitmentDraft,
  canSubmitRecruitment,
} from "@/domain/rules/recruitment";
import {
  canAssignInterviewer,
  canDecideRecruitment,
  canManageRecruitment,
  canViewAllRecruitment,
  hasPermission,
} from "@/domain/rules/permissions";
import type { RecruitmentCandidate } from "@/domain/types/hr";
import {
  AuthError,
  requireSession,
} from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { EmailPort } from "@/infrastructure/email/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";

export type RecruitmentDraftInput = {
  fullName: string;
  email: string;
  phone?: string | null;
  positionTitle: string;
  departmentId?: string | null;
  hrNotes?: string | null;
};

async function notifyChefs(
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
    const isChef =
      account?.role === "chef_de_projet" ||
      recipient.id === "emp-julien";
    if (!isChef) continue;
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

export function createRecruitmentService(deps: {
  hr: HrRepository;
  email: EmailPort;
  storage: DocumentStoragePort;
}) {
  async function requireCandidateAccess(
    session: AuthSession,
    candidate: RecruitmentCandidate,
  ) {
    if (canViewAllRecruitment(session.role)) return;
    if (
      hasPermission(session.role, "recruitment.view_assigned") &&
      candidate.interviewerEmployeeId === session.employee.id
    ) {
      return;
    }
    throw new AuthError("Accès refusé à ce dossier de recrutement.", 403);
  }

  return {
    async listVisible(
      session: AuthSession,
      filter?: {
        status?: RecruitmentCandidate["status"] | RecruitmentCandidate["status"][];
        q?: string;
      },
    ) {
      requireSession(session);
      if (canViewAllRecruitment(session.role)) {
        return deps.hr.listRecruitmentCandidates(filter);
      }
      if (hasPermission(session.role, "recruitment.view_assigned")) {
        return deps.hr.listRecruitmentCandidates({
          ...filter,
          interviewerEmployeeId: session.employee.id,
        });
      }
      return [];
    },

    async get(session: AuthSession, id: string) {
      requireSession(session);
      const candidate = await deps.hr.getRecruitmentCandidate(id);
      if (!candidate) throw new AuthError("Dossier introuvable.", 404);
      await requireCandidateAccess(session, candidate);
      const events = await deps.hr.listRecruitmentEvents(id);
      return { candidate, events };
    },

    async createDraft(session: AuthSession, input: RecruitmentDraftInput) {
      requireSession(session);
      if (!canManageRecruitment(session.role)) {
        throw new AuthError("Création réservée aux rôles RH autorisés.", 403);
      }
      const candidate = await deps.hr.createRecruitmentCandidate({
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        positionTitle: input.positionTitle.trim(),
        departmentId: input.departmentId || null,
        cvStorageKey: null,
        cvFileName: null,
        cvContentType: null,
        hrNotes: input.hrNotes?.trim() || null,
        status: "brouillon",
        submittedAt: null,
        createdByEmployeeId: session.employee.id,
        decidedByEmployeeId: null,
        decisionComment: null,
        decidedAt: null,
        interviewerEmployeeId: null,
        assignedByEmployeeId: null,
        assignedAt: null,
      });
      await deps.hr.addRecruitmentEvent({
        candidateId: candidate.id,
        kind: "created",
        message: "Dossier candidat créé.",
        actorId: session.employee.id,
      });
      return candidate;
    },

    async updateDraft(
      session: AuthSession,
      id: string,
      input: RecruitmentDraftInput,
    ) {
      requireSession(session);
      if (!canManageRecruitment(session.role)) {
        throw new AuthError("Modification réservée aux rôles RH.", 403);
      }
      const existing = await deps.hr.getRecruitmentCandidate(id);
      if (!existing) throw new AuthError("Dossier introuvable.", 404);
      if (!canEditRecruitmentDraft(existing.status)) {
        throw new Error(
          "Seuls les brouillons peuvent être modifiés librement.",
        );
      }
      return deps.hr.updateRecruitmentCandidate(id, {
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        positionTitle: input.positionTitle.trim(),
        departmentId: input.departmentId || null,
        hrNotes: input.hrNotes?.trim() || null,
      });
    },

    async uploadCv(
      session: AuthSession,
      id: string,
      file: { fileName: string; contentType: string; bytes: Uint8Array },
    ) {
      requireSession(session);
      if (!canManageRecruitment(session.role)) {
        throw new AuthError("Upload CV réservé aux rôles RH.", 403);
      }
      const existing = await deps.hr.getRecruitmentCandidate(id);
      if (!existing) throw new AuthError("Dossier introuvable.", 404);
      if (!canEditRecruitmentDraft(existing.status)) {
        throw new Error("Le CV ne peut plus être modifié après soumission.");
      }
      const check = assertCvFile({
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.bytes.byteLength,
      });
      if (!check.ok) throw new Error(check.message);

      const key = `recruitment/${id}/${Date.now()}-${file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await deps.storage.putObject(key, file.bytes, file.contentType);
      const updated = await deps.hr.updateRecruitmentCandidate(id, {
        cvStorageKey: key,
        cvFileName: file.fileName,
        cvContentType: file.contentType,
      });
      await deps.hr.addRecruitmentEvent({
        candidateId: id,
        kind: "cv_uploaded",
        message: `CV déposé : ${file.fileName}`,
        actorId: session.employee.id,
      });
      return updated;
    },

    async submit(session: AuthSession, id: string) {
      requireSession(session);
      if (!canManageRecruitment(session.role)) {
        throw new AuthError("Soumission réservée aux rôles RH.", 403);
      }
      const existing = await deps.hr.getRecruitmentCandidate(id);
      if (!existing) throw new AuthError("Dossier introuvable.", 404);
      if (!canSubmitRecruitment(existing.status)) {
        throw new Error("Ce dossier ne peut pas être soumis.");
      }
      if (!existing.cvStorageKey) {
        throw new Error("Un CV est obligatoire avant soumission.");
      }
      if (!existing.hrNotes?.trim()) {
        throw new Error("Le compte rendu RH est obligatoire avant soumission.");
      }
      const updated = await deps.hr.updateRecruitmentCandidate(id, {
        status: "soumis_revue",
        submittedAt: new Date().toISOString(),
      });
      await deps.hr.addRecruitmentEvent({
        candidateId: id,
        kind: "submitted",
        message: "Dossier soumis pour revue Chef de projet.",
        actorId: session.employee.id,
      });
      await notifyChefs(
        deps,
        "Recrutement à revoir",
        `${existing.fullName} — ${existing.positionTitle}`,
        `/entretiens/${id}`,
      );
      return updated;
    },

    async decide(
      session: AuthSession,
      id: string,
      decision: "approuve" | "refuse",
      comment?: string,
    ) {
      requireSession(session);
      if (!canDecideRecruitment(session.role)) {
        throw new AuthError(
          "Seuls les Chefs de projet peuvent approuver ou refuser un recrutement.",
          403,
        );
      }
      const existing = await deps.hr.getRecruitmentCandidate(id);
      if (!existing) throw new AuthError("Dossier introuvable.", 404);
      if (!canDecideRecruitmentStatus(existing.status)) {
        throw new Error("Ce dossier n'est pas en attente de revue.");
      }
      if (decision === "refuse" && !comment?.trim()) {
        throw new Error("Un motif de refus est obligatoire.");
      }
      const updated = await deps.hr.updateRecruitmentCandidate(id, {
        status: decision,
        decidedByEmployeeId: session.employee.id,
        decidedAt: new Date().toISOString(),
        decisionComment: comment?.trim() || null,
      });
      await deps.hr.addRecruitmentEvent({
        candidateId: id,
        kind: decision === "approuve" ? "approved" : "rejected",
        message:
          decision === "approuve"
            ? "Candidature approuvée."
            : `Candidature refusée : ${comment?.trim()}`,
        actorId: session.employee.id,
      });
      await deps.hr.addNotification({
        recipientId: existing.createdByEmployeeId,
        title:
          decision === "approuve"
            ? "Recrutement approuvé"
            : "Recrutement refusé",
        body: `${existing.fullName} — ${existing.positionTitle}`,
        href: `/entretiens/${id}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      return updated;
    },

    async assignInterviewer(
      session: AuthSession,
      id: string,
      interviewerEmployeeId: string,
    ) {
      requireSession(session);
      if (!canAssignInterviewer(session.role)) {
        throw new AuthError(
          "L'assignation d'intervieweur est réservée au Chef de projet.",
          403,
        );
      }
      const existing = await deps.hr.getRecruitmentCandidate(id);
      if (!existing) throw new AuthError("Dossier introuvable.", 404);
      if (!canAssignInterviewerStatus(existing.status)) {
        throw new Error(
          "Assignez un intervieweur uniquement après approbation.",
        );
      }
      const interviewer = await deps.hr.getEmployee(interviewerEmployeeId);
      if (!interviewer || !interviewer.isActive) {
        throw new Error(
          "L'intervieweur doit être un collaborateur actif dans ASTER.",
        );
      }
      const updated = await deps.hr.updateRecruitmentCandidate(id, {
        status: "intervieweur_assigne",
        interviewerEmployeeId,
        assignedByEmployeeId: session.employee.id,
        assignedAt: new Date().toISOString(),
      });
      await deps.hr.addRecruitmentEvent({
        candidateId: id,
        kind: "interviewer_assigned",
        message: `Intervieweur assigné : ${interviewer.firstName} ${interviewer.lastName}`,
        actorId: session.employee.id,
      });
      await deps.hr.addNotification({
        recipientId: interviewer.id,
        title: "Entretien de recrutement assigné",
        body: `${existing.fullName} — ${existing.positionTitle}`,
        href: `/entretiens/${id}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      await deps.hr.addNotification({
        recipientId: existing.createdByEmployeeId,
        title: "Intervieweur assigné",
        body: `${interviewer.firstName} ${interviewer.lastName} pour ${existing.fullName}`,
        href: `/entretiens/${id}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      return updated;
    },

    async getCvDownloadUrl(session: AuthSession, id: string) {
      requireSession(session);
      const candidate = await deps.hr.getRecruitmentCandidate(id);
      if (!candidate) throw new AuthError("Dossier introuvable.", 404);
      await requireCandidateAccess(session, candidate);
      if (!candidate.cvStorageKey) {
        throw new Error("Aucun CV disponible.");
      }
      return deps.storage.getDownloadUrl(candidate.cvStorageKey, 120);
    },
  };
}

export type RecruitmentService = ReturnType<typeof createRecruitmentService>;
