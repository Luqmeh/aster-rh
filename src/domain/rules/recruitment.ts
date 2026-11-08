import type { RecruitmentStatus } from "@/domain/types/hr";

export const RECRUITMENT_STATUSES: RecruitmentStatus[] = [
  "brouillon",
  "soumis_revue",
  "refuse",
  "approuve",
  "intervieweur_assigne",
  "entretien_planifie",
  "entretien_termine",
];

export function recruitmentStatusLabel(status: RecruitmentStatus): string {
  const labels: Record<RecruitmentStatus, string> = {
    brouillon: "Brouillon",
    soumis_revue: "Soumis pour revue",
    refuse: "Refusé",
    approuve: "Approuvé",
    intervieweur_assigne: "Intervieweur assigné",
    entretien_planifie: "Entretien planifié",
    entretien_termine: "Entretien terminé",
  };
  return labels[status];
}

export const ALLOWED_CV_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export function assertCvFile(input: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; message: string } {
  const lower = input.fileName.toLowerCase();
  if (
    !(
      lower.endsWith(".pdf") ||
      lower.endsWith(".doc") ||
      lower.endsWith(".docx")
    )
  ) {
    return {
      ok: false,
      message: "Formats CV acceptés : PDF, DOC, DOCX.",
    };
  }
  if (
    !ALLOWED_CV_MIME_TYPES.includes(
      input.contentType as (typeof ALLOWED_CV_MIME_TYPES)[number],
    ) &&
    input.contentType !== "application/octet-stream"
  ) {
    // octet-stream tolerated if extension is valid
    if (!lower.endsWith(".pdf") && !lower.endsWith(".doc") && !lower.endsWith(".docx")) {
      return { ok: false, message: "Type de fichier non autorisé." };
    }
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_CV_BYTES) {
    return {
      ok: false,
      message: "La taille du CV doit être comprise entre 1 octet et 5 Mo.",
    };
  }
  if (/\.(exe|sh|bat|js|mjs|dll|bin)$/i.test(lower)) {
    return { ok: false, message: "Fichier exécutable refusé." };
  }
  return { ok: true };
}

export function canEditRecruitmentDraft(status: RecruitmentStatus): boolean {
  return status === "brouillon";
}

export function canSubmitRecruitment(status: RecruitmentStatus): boolean {
  return status === "brouillon";
}

export function canDecideRecruitmentStatus(
  status: RecruitmentStatus,
): boolean {
  return status === "soumis_revue";
}

export function canAssignInterviewerStatus(
  status: RecruitmentStatus,
): boolean {
  return status === "approuve" || status === "intervieweur_assigne";
}
