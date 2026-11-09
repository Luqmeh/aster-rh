import { z } from "zod";
import type {
  AbsenceDocumentKind,
  AbsenceFamily,
  WorkAbsenceCategory,
  WorkAbsenceStatus,
} from "@/domain/types/hr";
import { parseDateOnly, toDateOnly } from "@/domain/rules/dates";
import { moroccoCalendarDayFromIso, moroccoToday } from "@/domain/rules/reporting";

/** Délais guide RH (rappels administratifs, pas de détermination légale automatisée). */
export const EMPLOYER_NOTIFY_HOURS = 24;
export const SUPPORTING_DOC_HOURS = 48;
export const PATERNITY_NOTICE_DAYS = 30;
export const PAYROLL_CUTOFF_DAY = 20;
export const RECURRENCE_WINDOW_MONTHS = 3;
export const RETURN_VISIT_AFTER_DAYS = 30;
export const RETURN_VISIT_ARRANGE_WITHIN_DAYS = 8;

export const WORK_ABSENCE_STATUSES: WorkAbsenceStatus[] = [
  "declare",
  "en_attente_justificatif",
  "en_cours_verification",
  "informations_demandees",
  "enregistre",
  "termine",
  "refuse",
];

export const ARRET_CATEGORIES: WorkAbsenceCategory[] = [
  "arret_maladie",
  "accident_travail",
  "accident_trajet",
  "maladie_professionnelle",
  "conge_maternite",
  "conge_paternite",
  "conge_pathologique",
  "prolongation_arret",
  "rechute",
];

export const SPECIAL_LEAVE_CATEGORIES: WorkAbsenceCategory[] = [
  "mariage_pacs",
  "naissance_adoption",
  "deces_proche",
  "demenagement",
  "hospitalisation_enfant",
  "annonce_handicap_ald",
  "rdv_medicaux_handicap",
  "preparation_examen_alternant",
];

export function familyForCategory(
  category: WorkAbsenceCategory,
): AbsenceFamily {
  return SPECIAL_LEAVE_CATEGORIES.includes(category) ? "conge_special" : "arret";
}

export function workAbsenceCategoryLabel(
  category: WorkAbsenceCategory,
): string {
  const labels: Record<WorkAbsenceCategory, string> = {
    arret_maladie: "Arrêt maladie",
    accident_travail: "Accident du travail",
    accident_trajet: "Accident de trajet",
    maladie_professionnelle: "Maladie professionnelle",
    conge_maternite: "Congé maternité",
    conge_paternite: "Congé paternité",
    conge_pathologique: "Congé pathologique",
    prolongation_arret: "Prolongation d'arrêt",
    rechute: "Rechute",
    mariage_pacs: "Mariage / PACS",
    naissance_adoption: "Naissance / adoption",
    deces_proche: "Décès d'un proche",
    demenagement: "Déménagement",
    hospitalisation_enfant: "Hospitalisation d'un enfant",
    annonce_handicap_ald: "Annonce handicap / ALD (enfant ou conjoint)",
    rdv_medicaux_handicap: "RDV médicaux (travailleur handicapé)",
    preparation_examen_alternant: "Préparation d'examen (alternant)",
  };
  return labels[category];
}

export function workAbsenceStatusLabel(status: WorkAbsenceStatus): string {
  const labels: Record<WorkAbsenceStatus, string> = {
    declare: "Déclaré",
    en_attente_justificatif: "En attente de justificatif",
    en_cours_verification: "En cours de vérification",
    informations_demandees: "Informations demandées",
    enregistre: "Enregistré",
    termine: "Terminé",
    refuse: "Refusé",
  };
  return labels[status];
}

export function absenceDocumentKindLabel(kind: AbsenceDocumentKind): string {
  const labels: Record<AbsenceDocumentKind, string> = {
    certificat_initial: "Certificat médical initial",
    certificat_prolongation: "Certificat de prolongation",
    bulletin_hospitalisation: "Bulletin de situation (hospitalisation)",
    dossier_at_mp: "Dossier accident du travail / maladie professionnelle",
    calendrier_maternite: "Calendrier de congé maternité",
    notification_paternite: "Notification / justificatif paternité",
    justificatif_special: "Justificatif congé spécial",
    autre: "Autre justificatif",
  };
  return labels[kind];
}

export const declareWorkAbsenceSchema = z
  .object({
    category: z.enum([
      "arret_maladie",
      "accident_travail",
      "accident_trajet",
      "maladie_professionnelle",
      "conge_maternite",
      "conge_paternite",
      "conge_pathologique",
      "prolongation_arret",
      "rechute",
      "mariage_pacs",
      "naissance_adoption",
      "deces_proche",
      "demenagement",
      "hospitalisation_enfant",
      "annonce_handicap_ald",
      "rdv_medicaux_handicap",
      "preparation_examen_alternant",
    ]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    comment: z.string().max(1000).optional(),
    parentAbsenceId: z.string().optional().nullable(),
    recurrenceOfId: z.string().optional().nullable(),
    hospitalAdmissionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    hospitalDischargeDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "La date de fin doit être postérieure ou égale au début.",
        path: ["endDate"],
      });
    }
    if (value.category === "prolongation_arret" && !value.parentAbsenceId) {
      ctx.addIssue({
        code: "custom",
        message: "Une prolongation doit référencer l'arrêt d'origine.",
        path: ["parentAbsenceId"],
      });
    }
  });

export type DeclareWorkAbsenceInput = z.infer<typeof declareWorkAbsenceSchema>;

export function hoursSinceStart(
  startDate: string,
  now = new Date(),
): number {
  const start = parseDateOnly(startDate);
  return (now.getTime() - start.getTime()) / 3_600_000;
}

export function isEmployerNotifyOverdue(
  startDate: string,
  declaredAtIso: string,
): boolean {
  const start = parseDateOnly(startDate).getTime();
  const declared = new Date(declaredAtIso).getTime();
  return declared - start > EMPLOYER_NOTIFY_HOURS * 3_600_000;
}

export function isSupportingDocOverdue(
  startDate: string,
  hasDocument: boolean,
  now = new Date(),
): boolean {
  if (hasDocument) return false;
  return hoursSinceStart(startDate, now) > SUPPORTING_DOC_HOURS;
}

export function paternityNoticeReminder(
  startDate: string,
  declaredAtIso: string,
): { ok: boolean; message: string | null } {
  const start = parseDateOnly(startDate);
  const declaredDay = moroccoCalendarDayFromIso(declaredAtIso);
  const declared = parseDateOnly(declaredDay);
  const diffDays = Math.floor(
    (start.getTime() - declared.getTime()) / 86_400_000,
  );
  if (diffDays < PATERNITY_NOTICE_DAYS) {
    return {
      ok: false,
      message: `Rappel guide : les dates de paternité devraient être communiquées au moins ${PATERNITY_NOTICE_DAYS} jours à l'avance.`,
    };
  }
  return { ok: true, message: null };
}

/** Documents reçus le jour J ≤ 20 → mois M ; sinon mois M+1 (rappel admin, pas de paie). */
export function payrollProcessingMonth(
  documentReceivedDateOnly: string,
): string {
  const [y, m, d] = documentReceivedDateOnly.split("-").map(Number);
  if (d <= PAYROLL_CUTOFF_DAY) {
    return `${y}-${String(m).padStart(2, "0")}`;
  }
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `${next.y}-${String(next.m).padStart(2, "0")}`;
}

export function addCalendarDays(dateOnly: string, days: number): string {
  const d = parseDateOnly(dateOnly);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

export function isContinuousExtension(
  parentEndDate: string,
  extensionStartDate: string,
): boolean {
  const expected = addCalendarDays(parentEndDate, 1);
  return extensionStartDate === expected || extensionStartDate === parentEndDate;
}

export function hasDateGap(
  parentEndDate: string,
  extensionStartDate: string,
): boolean {
  return extensionStartDate > addCalendarDays(parentEndDate, 1);
}

export function isWithinRecurrenceWindow(
  originalStartDate: string,
  recurrenceStartDate: string,
  months = RECURRENCE_WINDOW_MONTHS,
): boolean {
  const origin = parseDateOnly(originalStartDate);
  const recur = parseDateOnly(recurrenceStartDate);
  const limit = new Date(origin);
  limit.setUTCMonth(limit.getUTCMonth() + months);
  return recur.getTime() <= limit.getTime() && recur >= origin;
}

export function requiresReturnToWorkVisit(input: {
  category: WorkAbsenceCategory;
  startDate: string;
  endDate: string;
}): boolean {
  if (
    input.category === "conge_maternite" ||
    input.category === "accident_travail" ||
    input.category === "maladie_professionnelle" ||
    input.category === "accident_trajet"
  ) {
    return true;
  }
  const start = parseDateOnly(input.startDate);
  const end = parseDateOnly(input.endDate);
  const days =
    Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return days >= RETURN_VISIT_AFTER_DAYS;
}

export function returnVisitDeadline(actualReturnDate: string): string {
  return addCalendarDays(actualReturnDate, RETURN_VISIT_ARRANGE_WITHIN_DAYS);
}

export function initialStatusForDeclaration(hasDocument: boolean): WorkAbsenceStatus {
  return hasDocument ? "declare" : "en_attente_justificatif";
}

export function calendarTitleForViewer(
  category: WorkAbsenceCategory,
  viewer: "self" | "peer" | "hr" | "chef",
): string {
  if (viewer === "peer") return "Absence";
  if (viewer === "chef") {
    // Opérationnel sans motif médical détaillé
    if (familyForCategory(category) === "conge_special") {
      return workAbsenceCategoryLabel(category);
    }
    return "Absence (arrêt)";
  }
  return workAbsenceCategoryLabel(category);
}

export const MAX_ABSENCE_DOC_BYTES = 8 * 1024 * 1024;

export function employeeAbsenceStoragePrefix(
  employeeId: string,
  absenceId: string,
): string {
  return `employee-absence-documents/${employeeId}/${absenceId}/`;
}

export function buildAbsenceDocumentStorageKey(
  employeeId: string,
  absenceId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${employeeAbsenceStoragePrefix(employeeId, absenceId)}${Date.now()}-${safe}`;
}

export function assertAbsenceStorageKeyOwnership(
  storageKey: string,
  employeeId: string,
  absenceId: string,
): void {
  const prefix = employeeAbsenceStoragePrefix(employeeId, absenceId);
  if (!storageKey.startsWith(prefix)) {
    throw new Error("Clé de stockage absences invalide.");
  }
}

export function administrativeNotesForCategory(
  category: WorkAbsenceCategory,
): string[] {
  const notes: string[] = [];
  if (
    category === "arret_maladie" ||
    category === "prolongation_arret" ||
    category === "rechute" ||
    category === "conge_pathologique"
  ) {
    notes.push(
      "Guide : acquisition RTT suspendue pour les non-cadres pendant un arrêt maladie (information RH — pas d'ajustement automatique des soldes).",
    );
    notes.push(
      "Guide : pas d'éligibilité titres-restaurant pendant un arrêt maladie (information RH — hors paie ASTER).",
    );
  }
  if (category === "conge_maternite" || category === "conge_paternite") {
    notes.push(
      "Guide : maintien des droits à congés payés pendant maternité / paternité.",
    );
  }
  if (
    category === "accident_travail" ||
    category === "maladie_professionnelle" ||
    category === "accident_trajet"
  ) {
    notes.push(
      "Guide : maintien des droits à congés payés pendant un an en cas d'AT / maladie professionnelle (information RH).",
    );
  }
  return notes;
}

export function reminderBannerTexts(today = moroccoToday()): {
  notify24h: string;
  docs48h: string;
  payrollCutoff: string;
} {
  void today;
  return {
    notify24h:
      "Rappel guide : informer l'employeur dans les 24 h suivant le début de l'absence.",
    docs48h:
      "Rappel guide : transmettre le justificatif dans les 48 h suivant le début de l'absence.",
    payrollCutoff: `Rappel guide : justificatifs reçus jusqu'au ${PAYROLL_CUTOFF_DAY} inclus traités sur le mois en cours ; au-delà, mois suivant (pas de calcul de paie dans ASTER).`,
  };
}
