/** Règles et filtres du reporting RH — fuseau Africa/Casablanca. */

export const MOROCCO_TZ = "Africa/Casablanca";

/** Aujourd'hui (yyyy-mm-dd) en fuseau Maroc. */
export function moroccoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOROCCO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function moroccoYearMonth(dateOnly: string): string {
  return dateOnly.slice(0, 7);
}

export type ReportPeriodPreset =
  | "ce_mois"
  | "mois_precedent"
  | "ce_trimestre"
  | "cette_annee"
  | "personnalise";

export type ReportFilters = {
  startDate: string;
  endDate: string;
  preset: ReportPeriodPreset;
  departmentId?: string | null;
  employeeId?: string | null;
  employmentStatus?: "actif" | "inactif" | "parti" | null;
  requestStatus?: string | null;
};

const MAX_RANGE_DAYS = 366 * 2;

export function resolveReportPeriod(
  preset: ReportPeriodPreset,
  customStart?: string | null,
  customEnd?: string | null,
  now = new Date(),
): { startDate: string; endDate: string; preset: ReportPeriodPreset } {
  const today = moroccoToday(now);
  const [y, m] = today.split("-").map(Number);

  if (preset === "personnalise") {
    const start = customStart?.trim() || today;
    const end = customEnd?.trim() || today;
    if (end < start) {
      throw new Error("La date de fin doit être postérieure ou égale au début.");
    }
    assertRangeWithinLimit(start, end);
    return { startDate: start, endDate: end, preset };
  }

  if (preset === "ce_mois") {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    return { startDate: start, endDate: today, preset };
  }

  if (preset === "mois_precedent") {
    const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
    const start = `${prev.y}-${String(prev.m).padStart(2, "0")}-01`;
    const endDay = new Date(Date.UTC(prev.y, prev.m, 0)).getUTCDate();
    const end = `${prev.y}-${String(prev.m).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    return { startDate: start, endDate: end, preset };
  }

  if (preset === "ce_trimestre") {
    const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
    const start = `${y}-${String(qStartMonth).padStart(2, "0")}-01`;
    return { startDate: start, endDate: today, preset };
  }

  // cette_annee
  return { startDate: `${y}-01-01`, endDate: today, preset };
}

export function assertRangeWithinLimit(start: string, end: string): void {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  const days = Math.floor((b - a) / 86_400_000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new Error(
      `Période trop large (max ${MAX_RANGE_DAYS} jours). Affinez les filtres.`,
    );
  }
}

export function isDateInRange(
  dateOnly: string,
  start: string,
  end: string,
): boolean {
  return dateOnly >= start && dateOnly <= end;
}

export function isoInRange(
  iso: string | null | undefined,
  start: string,
  end: string,
): boolean {
  if (!iso) return false;
  const day = moroccoCalendarDayFromIso(iso);
  return isDateInRange(day, start, end);
}

/** Jour calendaire Maroc dérivé d'un Instant ISO. */
export function moroccoCalendarDayFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOROCCO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export type ReportingKpis = {
  effectifActif: number;
  nouveauxCollaborateurs: number;
  departs: number;
  collaborateursInactifs: number;
  demandesConges: number;
  absencesApprouveesJours: number;
  demandesCongesApprouvees: number;
  demandesEnAttente: number;
  demandesTeletravail: number;
  demandesDocumentsEnAttente: number;
  recrutementsEnCours: number;
  recuperationCrediteeHeures: number;
  recuperationCrediteeJours: number;
  arretsEnCours: number;
  justificatifsManquants: number;
  congesSpeciauxPeriode: number;
  visitesRepriseAPlanifier: number;
};

export const PENDING_LEAVE_STATUSES = new Set([
  "soumise",
  "en_attente_manager",
  "en_attente_rh",
]);

export const APPROVED_LEAVE_STATUS = "approuvee";

export const OPEN_RECRUITMENT = new Set([
  "brouillon",
  "soumis_revue",
  "approuve",
  "intervieweur_assigne",
  "entretien_planifie",
]);

export const OPEN_DOCUMENT_STATUSES = new Set([
  "en_attente",
  "en_traitement",
  "informations_demandees",
]);

export function reportFilename(reportKey: string, day: string): string {
  const safe = reportKey.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
  return `ASTER_${safe}_${day.replace(/-/g, "")}.xlsx`;
}

export const REPORT_EXPORT_KEYS = [
  "conges_mois",
  "planning_absences",
  "soldes",
  "teletravail",
  "annuaire",
  "recrutement",
  "documents",
  "travail_ferie",
  "lifecycle",
  "historique",
  "arrets_absences",
] as const;

export type ReportExportKey = (typeof REPORT_EXPORT_KEYS)[number];

export function reportExportLabel(key: ReportExportKey): string {
  const labels: Record<ReportExportKey, string> = {
    conges_mois: "Congés du mois",
    planning_absences: "Planning des absences",
    soldes: "Soldes CP / RTT / récupération",
    teletravail: "Télétravail",
    annuaire: "Annuaire / Effectifs",
    recrutement: "Recrutement",
    documents: "Demandes de documents",
    travail_ferie: "Travail férié & récupération",
    lifecycle: "Onboarding & cycle de vie",
    historique: "Historique des demandes",
    arrets_absences: "Arrêts & absences spéciales",
  };
  return labels[key];
}
