import type { EmploymentStatus } from "@/domain/types/hr";

export const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "actif",
  "inactif",
  "parti",
];

export function employmentStatusLabel(status: EmploymentStatus): string {
  const labels: Record<EmploymentStatus, string> = {
    actif: "Actif",
    inactif: "Inactif",
    parti: "Parti",
  };
  return labels[status];
}

export function isEmploymentAccessible(status: EmploymentStatus): boolean {
  return status === "actif";
}

export function syncIsActive(status: EmploymentStatus): boolean {
  return isEmploymentAccessible(status);
}

export function assertLifecycleTransition(input: {
  from: EmploymentStatus;
  to: EmploymentStatus;
}): { ok: true } | { ok: false; message: string } {
  if (input.from === input.to) {
    return { ok: false, message: "Le statut d'emploi est déjà à cette valeur." };
  }
  if (input.from === "parti" && input.to !== "actif") {
    return {
      ok: false,
      message:
        "Un collaborateur parti ne peut être que réactivé (statut Actif).",
    };
  }
  return { ok: true };
}

export function initialsFromName(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "XX";
}

export function normalizeEmployeeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmployeeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmployeeEmail(email));
}

export function isValidEmployeeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{2,63}$/i.test(id.trim());
}
