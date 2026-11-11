import { applyColumnMapping } from "@/domain/rules/hr-import/parse";
import type {
  HrImportBalanceDraft,
  HrImportEmployeeDraft,
  HrImportPreviewSummary,
} from "@/domain/types/hr-import";
import { pendingImportEmail } from "@/domain/types/hr-import";
import type { ContractType, Employee, EmploymentStatus, OrganizationUnit } from "@/domain/types/hr";
import { isValidEmployeeEmail } from "@/domain/rules/lifecycle";

const CONTRACTS = new Set<ContractType>(["cdi", "cdd", "alternance", "stage"]);
const STATUSES = new Set<EmploymentStatus>(["actif", "inactif", "parti"]);

export function parseIsoDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  // Excel serial sometimes arrives as number string
  if (/^\d+(\.\d+)?$/.test(t)) {
    const serial = Number(t);
    if (serial > 20000 && serial < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + Math.floor(serial) * 86400000;
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  const fr = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (fr) {
    const dd = fr[1]!.padStart(2, "0");
    const mm = fr[2]!.padStart(2, "0");
    const yyyy = fr[3]!;
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

export function parseDecimalFr(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

export function resolveDepartmentId(
  raw: string,
  departments: OrganizationUnit[],
  mapping: Record<string, string>,
): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (mapping[raw]) return mapping[raw];
  if (mapping[key]) return mapping[key];
  const hit = departments.find(
    (d) =>
      d.id === raw ||
      d.code.toLowerCase() === key ||
      d.name.toLowerCase() === key,
  );
  return hit?.id ?? null;
}

export function normalizeContractType(raw: string): ContractType | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (CONTRACTS.has(t as ContractType)) return t as ContractType;
  return null;
}

export function normalizeEmploymentStatus(raw: string): EmploymentStatus | null {
  const t = raw.trim().toLowerCase();
  if (!t) return "actif";
  if (STATUSES.has(t as EmploymentStatus)) return t as EmploymentStatus;
  if (t === "active") return "actif";
  if (t === "inactive") return "inactif";
  return null;
}

export function hoursToRecoveryDays(
  hours: number,
  standardDailyHours = 7,
): number {
  const daily = standardDailyHours > 0 ? standardDailyHours : 7;
  return Math.round((hours / daily) * 1000) / 1000;
}

export function resolveSite(
  raw: string,
  knownSites: string[],
  mapping: Record<string, string>,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (mapping[trimmed]) return mapping[trimmed];
  const key = trimmed.toLowerCase();
  if (mapping[key]) return mapping[key];
  const hit = knownSites.find((s) => s.toLowerCase() === key);
  if (hit) return hit;
  // Nouveau site autorisé avec avertissement côté appelant — valeur brute.
  return trimmed;
}

export function validateEmployeeRows(input: {
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
  mapping: Record<string, string>;
  departmentMapping: Record<string, string>;
  siteMapping?: Record<string, string>;
  departments: OrganizationUnit[];
  knownSites?: string[];
  existingEmployees: Employee[];
  updateExisting: boolean;
}): HrImportEmployeeDraft[] {
  const byId = new Map(input.existingEmployees.map((e) => [e.id, e]));
  const byEmail = new Map(
    input.existingEmployees.map((e) => [e.email.toLowerCase(), e]),
  );
  const seenMatricules = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  return input.rows.map((row) => {
    const cells = applyColumnMapping(row.cells, input.mapping);
    const messages: string[] = [];
    let severity: HrImportEmployeeDraft["severity"] = "ok";

    const matricule = (cells.matricule ?? "").trim();
    const firstName = (cells.firstName ?? "").trim();
    const lastName = (cells.lastName ?? "").trim();
    const rawEmail = (cells.email ?? "").trim().toLowerCase();
    const emailMissing = !rawEmail;
    let email = rawEmail;
    const departmentRaw = (cells.department ?? "").trim();
    const jobTitle = (cells.jobTitle ?? "").trim();
    const site = (cells.site ?? "").trim();
    const hireDate = parseIsoDate(cells.hireDate ?? "");
    const contractType = normalizeContractType(cells.contractType ?? "");
    const employmentStatus = normalizeEmploymentStatus(
      cells.employmentStatus ?? "",
    );
    const managerMatricule = (cells.managerMatricule ?? "").trim() || null;

    if (!matricule) {
      messages.push("Matricule manquant.");
      severity = "error";
    } else if (seenMatricules.has(matricule)) {
      messages.push(
        `Matricule en double (déjà ligne ${seenMatricules.get(matricule)}).`,
      );
      severity = "error";
    } else {
      seenMatricules.set(matricule, row.rowNumber);
    }

    if (!firstName) {
      messages.push("Prénom manquant.");
      severity = "error";
    }
    if (!lastName) {
      messages.push("Nom manquant.");
      severity = "error";
    }
    if (emailMissing) {
      email = matricule ? pendingImportEmail(matricule) : "";
      messages.push(
        "E-mail professionnel absent — fiche importable, compte ASTER en attente.",
      );
      if (severity === "ok") severity = "warning";
    } else if (!isValidEmployeeEmail(email)) {
      messages.push("E-mail professionnel invalide.");
      severity = "error";
    } else if (seenEmails.has(email)) {
      messages.push(
        `E-mail en double (déjà ligne ${seenEmails.get(email)}).`,
      );
      severity = "error";
    } else {
      seenEmails.set(email, row.rowNumber);
    }

    if (!jobTitle) {
      messages.push("Poste manquant.");
      severity = "error";
    }
    const knownSites = input.knownSites ?? [];
    const resolvedSite = resolveSite(
      site,
      knownSites,
      input.siteMapping ?? {},
    );
    if (!resolvedSite) {
      messages.push("Site manquant.");
      severity = "error";
    } else if (
      knownSites.length > 0 &&
      !knownSites.some((s) => s.toLowerCase() === resolvedSite.toLowerCase()) &&
      !(input.siteMapping ?? {})[site] &&
      !(input.siteMapping ?? {})[site.toLowerCase()]
    ) {
      messages.push(
        `Site « ${resolvedSite} » absent du référentiel actuel — sera créé tel quel (vérifier le mapping).`,
      );
      if (severity === "ok") severity = "warning";
    }
    if (!hireDate) {
      messages.push("Date d'embauche invalide (attendu AAAA-MM-JJ ou JJ/MM/AAAA).");
      severity = "error";
    }
    if (!contractType) {
      messages.push("Type de contrat invalide (cdi, cdd, alternance, stage).");
      severity = "error";
    }
    if (!employmentStatus) {
      messages.push("Statut d'emploi invalide (actif, inactif, parti).");
      severity = "error";
    }

    const departmentId = resolveDepartmentId(
      departmentRaw,
      input.departments,
      input.departmentMapping,
    );
    if (!departmentId) {
      messages.push(
        departmentRaw
          ? `Département inconnu « ${departmentRaw} » — mapper ou créer l'unité.`
          : "Département manquant.",
      );
      severity = "error";
    }

    const existingById = matricule ? byId.get(matricule) : undefined;
    const existingByEmail = email ? byEmail.get(email) : undefined;
    let action: HrImportEmployeeDraft["action"] = "create";
    let existingEmployeeId: string | null = null;

    if (existingById) {
      existingEmployeeId = existingById.id;
      if (input.updateExisting) {
        action = "update";
        messages.push("Collaborateur existant — mise à jour explicite.");
        if (severity === "ok") severity = "warning";
      } else {
        action = "skip";
        messages.push(
          "Collaborateur existant — activez la mise à jour pour modifier la fiche.",
        );
        if (severity === "ok") severity = "warning";
      }
      if (
        existingByEmail &&
        existingByEmail.id !== existingById.id
      ) {
        messages.push(
          "Conflit d'identité : e-mail déjà utilisé par un autre matricule.",
        );
        severity = "error";
      }
    } else if (existingByEmail) {
      messages.push(
        `E-mail déjà utilisé pour ${existingByEmail.id} — conflit d'identité.`,
      );
      severity = "error";
      action = "skip";
      existingEmployeeId = existingByEmail.id;
    }

    let managerId: string | null = null;
    if (managerMatricule) {
      const mgr = byId.get(managerMatricule);
      if (!mgr) {
        messages.push(
          `Manager ${managerMatricule} introuvable — sera lié après création si présent dans le lot.`,
        );
        if (severity === "ok") severity = "warning";
      } else {
        managerId = mgr.id;
      }
    }

    if (severity === "error") action = "skip";

    return {
      rowNumber: row.rowNumber,
      matricule,
      firstName,
      lastName,
      email,
      emailMissing,
      departmentRaw,
      departmentId,
      jobTitle,
      site: resolvedSite ?? site,
      hireDate,
      contractType,
      employmentStatus,
      managerMatricule,
      managerId,
      action,
      existingEmployeeId,
      severity,
      messages,
    };
  });
}

export function validateBalanceRows(input: {
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
  mapping: Record<string, string>;
  employeeDrafts: HrImportEmployeeDraft[];
  existingEmployees: Employee[];
  standardDailyHours?: number;
}): HrImportBalanceDraft[] {
  const knownIds = new Set(input.existingEmployees.map((e) => e.id));
  for (const d of input.employeeDrafts) {
    if (d.severity !== "error" && d.matricule) knownIds.add(d.matricule);
  }
  const seen = new Map<string, number>();

  return input.rows.map((row) => {
    const cells = applyColumnMapping(row.cells, input.mapping);
    const messages: string[] = [];
    let severity: HrImportBalanceDraft["severity"] = "ok";
    const matricule = (cells.matricule ?? "").trim();
    const cpDays = parseDecimalFr(cells.cpDays ?? "");
    const rttDays = parseDecimalFr(cells.rttDays ?? "");
    const recoveryHours = parseDecimalFr(cells.recoveryHours ?? "");
    const effectiveDate = parseIsoDate(cells.effectiveDate ?? "");
    const sourceReference = (cells.sourceReference ?? "").trim();
    const verificationStatus = (
      cells.verificationStatus ?? "a_verifier"
    ).trim();
    const notes = (cells.notes ?? "").trim() || null;

    if (!matricule) {
      messages.push("Matricule manquant.");
      severity = "error";
    } else if (seen.has(matricule)) {
      messages.push(
        `Ligne de solde en double pour ${matricule} (déjà ligne ${seen.get(matricule)}).`,
      );
      severity = "error";
    } else {
      seen.set(matricule, row.rowNumber);
    }

    if (matricule && !knownIds.has(matricule)) {
      messages.push(
        "Collaborateur introuvable dans ASTER et absent des lignes collaborateurs valides du lot.",
      );
      severity = "error";
    }

    if (cpDays == null && rttDays == null && recoveryHours == null) {
      messages.push("Aucun solde renseigné (CP, RTT ou récupération).");
      severity = "error";
    }
    if (cpDays != null && cpDays < 0) {
      messages.push("Solde CP négatif refusé.");
      severity = "error";
    }
    if (rttDays != null && rttDays < 0) {
      messages.push("Solde RTT négatif refusé.");
      severity = "error";
    }
    if (recoveryHours != null && recoveryHours < 0) {
      messages.push("Récupération (heures) négative refusée.");
      severity = "error";
    }
    if (!effectiveDate) {
      messages.push("Date d'effet invalide ou manquante.");
      severity = "error";
    }
    if (!sourceReference) {
      messages.push("Référence source recommandée pour l'audit.");
      if (severity === "ok") severity = "warning";
    }
    if (verificationStatus.toLowerCase() !== "verifie" &&
      verificationStatus.toLowerCase() !== "vérifié" &&
      verificationStatus.toLowerCase() !== "verified") {
      messages.push(
        "Statut de vérification RH non confirmé — à contrôler avant exécution.",
      );
      if (severity === "ok") severity = "warning";
    }

    const recoveryDays =
      recoveryHours == null
        ? null
        : hoursToRecoveryDays(recoveryHours, input.standardDailyHours ?? 7);

    return {
      rowNumber: row.rowNumber,
      matricule,
      employeeId: matricule && knownIds.has(matricule) ? matricule : null,
      cpDays,
      rttDays,
      recoveryHours,
      recoveryDays,
      effectiveDate,
      sourceReference,
      verificationStatus,
      notes,
      severity,
      messages,
    };
  });
}

export function buildPreviewSummary(
  employees: HrImportEmployeeDraft[],
  balances: HrImportBalanceDraft[],
): HrImportPreviewSummary {
  const validEmp = employees.filter((e) => e.severity !== "error");
  const warnEmp = employees.filter((e) => e.severity === "warning");
  const invalidEmp = employees.filter((e) => e.severity === "error");
  const validBal = balances.filter((b) => b.severity !== "error");
  const warnBal = balances.filter((b) => b.severity === "warning");
  const invalidBal = balances.filter((b) => b.severity === "error");
  return {
    totalEmployeeRows: employees.length,
    validEmployeeRows: validEmp.length,
    warningEmployeeRows: warnEmp.length,
    invalidEmployeeRows: invalidEmp.length,
    newEmployees: employees.filter((e) => e.action === "create").length,
    existingEmployees: employees.filter(
      (e) => e.action === "update" || e.action === "skip",
    ).length,
    totalBalanceRows: balances.length,
    validBalanceRows: validBal.length,
    warningBalanceRows: warnBal.length,
    invalidBalanceRows: invalidBal.length,
    openingCpTotal: validBal.reduce((s, b) => s + (b.cpDays ?? 0), 0),
    openingRttTotal: validBal.reduce((s, b) => s + (b.rttDays ?? 0), 0),
    openingRecoveryDaysTotal: validBal.reduce(
      (s, b) => s + (b.recoveryDays ?? 0),
      0,
    ),
  };
}
