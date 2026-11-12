/**
 * Structure organisationnelle collaborateur ASTER (Maroc).
 * Grade = classification organisationnelle uniquement —
 * ne pilote ni soldes, ni RTT/récupération, ni permissions, ni autorité d'approbation.
 */

import { z } from "zod";

/** Valeurs stockées (API / Prisma / import). */
export const EMPLOYEE_GRADE_VALUES = [
  "auditeur_junior",
  "auditeur_senior",
  "manager",
] as const;

export type EmployeeGrade = (typeof EMPLOYEE_GRADE_VALUES)[number];

/** Libellés français exacts (UI + Excel). */
export const EMPLOYEE_GRADE_LABELS: Record<EmployeeGrade, string> = {
  auditeur_junior: "Auditeur junior",
  auditeur_senior: "Auditeur senior",
  manager: "Manager",
};

export const EMPLOYEE_GRADE_OPTIONS = EMPLOYEE_GRADE_VALUES.map((value) => ({
  value,
  label: EMPLOYEE_GRADE_LABELS[value],
}));

const GRADE_LABEL_TO_VALUE = Object.fromEntries(
  EMPLOYEE_GRADE_OPTIONS.map((o) => [o.label.toLowerCase(), o.value]),
) as Record<string, EmployeeGrade>;

/** Anciennes valeurs cadre / non-cadre — refusées par le contrat Grade. */
export const OBSOLETE_CATEGORY_VALUES = [
  "cadre",
  "non_cadre",
  "non_applicable",
  "Cadre",
  "Non-cadre",
  "Non cadre",
] as const;

export const employeeGradeSchema = z.enum(EMPLOYEE_GRADE_VALUES, {
  message:
    "Grade invalide. Valeurs acceptées : Auditeur junior, Auditeur senior, Manager.",
});

/**
 * Accepte la valeur stockée ou le libellé français exact (casse souple).
 * Refuse cadre / non-cadre et toute autre valeur.
 */
export function parseEmployeeGrade(
  raw: string | null | undefined,
):
  | { ok: true; value: EmployeeGrade }
  | { ok: false; message: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Grade obligatoire." };
  }
  if (
    OBSOLETE_CATEGORY_VALUES.some(
      (v) => v.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      message:
        "La catégorie cadre / non-cadre n'est plus acceptée. Utilisez Grade : Auditeur junior, Auditeur senior ou Manager.",
    };
  }
  if ((EMPLOYEE_GRADE_VALUES as readonly string[]).includes(trimmed)) {
    return { ok: true, value: trimmed as EmployeeGrade };
  }
  const fromLabel = GRADE_LABEL_TO_VALUE[trimmed.toLowerCase()];
  if (fromLabel) {
    return { ok: true, value: fromLabel };
  }
  return {
    ok: false,
    message:
      "Grade invalide. Valeurs acceptées : Auditeur junior, Auditeur senior, Manager.",
  };
}

export function employeeGradeLabel(grade: EmployeeGrade): string {
  return EMPLOYEE_GRADE_LABELS[grade];
}

/** Région — saisie libre, pas de liste prédéfinie. */
export const REGION_MAX_LENGTH = 120;

export const regionSchema = z
  .string()
  .trim()
  .min(1, "Région obligatoire.")
  .max(REGION_MAX_LENGTH, `Région : ${REGION_MAX_LENGTH} caractères maximum.`);

export function parseRegion(
  raw: string | null | undefined,
): { ok: true; value: string } | { ok: false; message: string } {
  const parsed = regionSchema.safeParse(raw ?? "");
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Région invalide.",
    };
  }
  return { ok: true, value: parsed.data };
}

/** Entrée catalogue People Manager (liée à un compte ou nom seul). */
export interface PeopleManagerEntry {
  id: string;
  displayName: string;
  linkedEmployeeId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const peopleManagerDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Nom du People Manager obligatoire.")
  .max(160, "Nom du People Manager : 160 caractères maximum.");
