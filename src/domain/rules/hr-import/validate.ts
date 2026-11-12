import { applyColumnMapping } from "@/domain/rules/hr-import/parse";
import type {
  HrImportBalanceDraft,
  HrImportEmployeeDraft,
  HrImportPreviewSummary,
} from "@/domain/types/hr-import";
import { pendingImportEmail } from "@/domain/types/hr-import";
import type { ContractType, Employee, EmploymentStatus, OrganizationUnit } from "@/domain/types/hr";
import {
  parseEmployeeGrade,
  parseRegion,
} from "@/domain/types/employee-structure";
import { isValidEmployeeEmail } from "@/domain/rules/lifecycle";
import { matchEmployeeForPeopleManager } from "@/domain/rules/people-manager";

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
  const t = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t) return null;
  if (CONTRACTS.has(t as ContractType)) return t as ContractType;
  if (t === "autre" || t === "a preciser" || t === "à préciser") {
    // Valeurs liste officielle — non inventées : mapper vers stage générique interdit.
    return null;
  }
  return null;
}

export function normalizeEmploymentStatus(raw: string): EmploymentStatus | null {
  const t = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t) return "actif";
  if (STATUSES.has(t as EmploymentStatus)) return t as EmploymentStatus;
  if (t === "active" || t === "actif") return "actif";
  if (t === "inactive" || t === "inactif" || t === "suspendu") return "inactif";
  if (t === "parti" || t === "sorti") return "parti";
  return null;
}

export function normalizeBalanceType(
  raw: string,
): "CP" | "RTT" | "RECUPERATION_HEURES" | null {
  const t = raw
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_");
  if (t === "CP" || t === "CONGES_PAYES" || t === "CONGE_PAYE") return "CP";
  if (t === "RTT") return "RTT";
  if (
    t === "RECUPERATION_HEURES" ||
    t === "RECUPERATION" ||
    t === "RECOVERY_HOURS"
  ) {
    return "RECUPERATION_HEURES";
  }
  return null;
}

export function normalizeBalanceUnit(raw: string): "jours" | "heures" | null {
  const t = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t) return null;
  if (t.startsWith("jour")) return "jours";
  if (t.startsWith("heur")) return "heures";
  return null;
}

export function hoursToRecoveryDays(
  hours: number,
  standardDailyHours = 7,
): number {
  const daily = standardDailyHours > 0 ? standardDailyHours : 7;
  return Math.round((hours / daily) * 1000) / 1000;
}

export function validateEmployeeRows(input: {
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
  mapping: Record<string, string>;
  departmentMapping: Record<string, string>;
  departments: OrganizationUnit[];
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
    const gradeRaw = (cells.grade ?? "").trim();
    const peopleManagerRaw = (cells.peopleManager ?? "").trim() || null;
    const regionRaw = (cells.region ?? "").trim();
    const obsoleteSite = (cells.site ?? "").trim();
    const obsoleteCategory = (cells.category ?? "").trim();
    const obsoleteManagerMatricule = (cells.managerMatricule ?? "").trim();
    const hireDate = parseIsoDate(cells.hireDate ?? "");
    const contractType = normalizeContractType(cells.contractType ?? "");
    const employmentStatus = normalizeEmploymentStatus(
      cells.employmentStatus ?? "",
    );

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
      messages.push("Poste / fonction non renseigné.");
      if (severity === "ok") severity = "warning";
    }

    if (obsoleteSite) {
      messages.push(
        "Colonne Site obsolète — renseigner Région (pas de conversion silencieuse).",
      );
      severity = "error";
    }
    if (obsoleteCategory) {
      messages.push(
        "Colonne Catégorie / cadre obsolète — renseigner Grade (Auditeur junior, Auditeur senior, Manager).",
      );
      severity = "error";
    }
    if (obsoleteManagerMatricule) {
      messages.push(
        "Colonne Manager hiérarchique / matricule responsable obsolète — renseigner People Manager.",
      );
      severity = "error";
    }

    let grade: string | null = null;
    const gradeParsed = parseEmployeeGrade(gradeRaw);
    if (!gradeParsed.ok) {
      messages.push(gradeParsed.message);
      severity = "error";
    } else {
      grade = gradeParsed.value;
    }

    let region: string | null = null;
    const regionParsed = parseRegion(regionRaw);
    if (!regionParsed.ok) {
      messages.push(regionParsed.message);
      severity = "error";
    } else {
      region = regionParsed.value;
    }

    if (!hireDate) {
      messages.push("Date d'embauche invalide (attendu AAAA-MM-JJ ou JJ/MM/AAAA).");
      severity = "error";
    }
    let resolvedContract = contractType;
    if ((cells.contractType ?? "").trim() && !contractType) {
      messages.push(
        "Type de contrat non reconnu (cdi, cdd, alternance, stage) — laisser vide ou corriger.",
      );
      severity = "error";
    } else if (!resolvedContract) {
      resolvedContract = "cdi";
      messages.push(
        "Type de contrat absent — fiche créée en CDI technique (champ optionnel du modèle).",
      );
      if (severity === "ok") severity = "warning";
    }
    if (!employmentStatus) {
      messages.push(
        "Statut invalide (Actif, Suspendu/Inactif, Sorti/Parti).",
      );
      severity = "error";
    }

    const departmentId = resolveDepartmentId(
      departmentRaw,
      input.departments,
      input.departmentMapping,
    );
    if (!departmentId) {
      if (departmentRaw) {
        messages.push(
          `Département inconnu « ${departmentRaw} » — mapper ou créer l'unité.`,
        );
        severity = "error";
      } else {
        messages.push(
          "Département non renseigné — attribution impossible sans unité.",
        );
        severity = "error";
      }
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

    if (peopleManagerRaw) {
      const matched = matchEmployeeForPeopleManager(
        input.existingEmployees,
        peopleManagerRaw,
      );
      if (!matched) {
        messages.push(
          `People Manager « ${peopleManagerRaw} » sans compte ASTER — entrée manuelle conservée à l'exécution.`,
        );
        if (severity === "ok") severity = "warning";
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
      grade,
      peopleManagerRaw,
      peopleManagerId: null,
      region,
      hireDate,
      contractType: resolvedContract,
      employmentStatus,
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

    // Format officiel (long) : Type de solde + Solde restant + Unité
    const balanceType = normalizeBalanceType(cells.balanceType ?? "");
    const balanceAmount = parseDecimalFr(cells.balanceAmount ?? "");
    const balanceUnit = normalizeBalanceUnit(cells.balanceUnit ?? "");

    // Format legacy (large) : colonnes CP / RTT / récupération
    let cpDays = parseDecimalFr(cells.cpDays ?? "");
    let rttDays = parseDecimalFr(cells.rttDays ?? "");
    let recoveryHours = parseDecimalFr(cells.recoveryHours ?? "");

    if (balanceType) {
      if (balanceAmount == null) {
        messages.push("Solde restant manquant ou invalide.");
        severity = "error";
      } else if (balanceAmount < 0) {
        messages.push("Solde négatif refusé.");
        severity = "error";
      }
      if (balanceType === "CP") {
        if (balanceUnit && balanceUnit !== "jours") {
          messages.push("CP doit être en jours (unité incorrecte).");
          severity = "error";
        }
        cpDays = balanceAmount;
        rttDays = null;
        recoveryHours = null;
      } else if (balanceType === "RTT") {
        if (balanceUnit && balanceUnit !== "jours") {
          messages.push("RTT doit être en jours (unité incorrecte).");
          severity = "error";
        }
        rttDays = balanceAmount;
        cpDays = null;
        recoveryHours = null;
      } else {
        if (balanceUnit && balanceUnit !== "heures") {
          messages.push(
            "RECUPERATION_HEURES doit être en heures — pas de conversion silencieuse en jours.",
          );
          severity = "error";
        }
        recoveryHours = balanceAmount;
        cpDays = null;
        rttDays = null;
      }
    }

    const effectiveDate = parseIsoDate(cells.effectiveDate ?? "");
    const sourceReference = [
      (cells.sourceReference ?? "").trim(),
      (cells.sourceTabReference ?? "").trim(),
    ]
      .filter(Boolean)
      .join(" / ");
    const verificationStatus = (
      cells.verificationStatus ?? "À vérifier"
    ).trim();
    const notes = (cells.notes ?? "").trim() || null;

    const dedupeKey = balanceType
      ? `${matricule}::${balanceType}`
      : matricule;

    if (!matricule) {
      messages.push("Matricule manquant.");
      severity = "error";
    } else if (seen.has(dedupeKey)) {
      messages.push(
        `Ligne de solde en double pour ${dedupeKey} (déjà ligne ${seen.get(dedupeKey)}).`,
      );
      severity = "error";
    } else {
      seen.set(dedupeKey, row.rowNumber);
    }

    if (matricule && !knownIds.has(matricule)) {
      messages.push(
        "Collaborateur introuvable dans ASTER et absent des lignes collaborateurs valides du lot.",
      );
      severity = "error";
    }

    if (
      !balanceType &&
      cpDays == null &&
      rttDays == null &&
      recoveryHours == null
    ) {
      messages.push(
        "Aucun solde renseigné (type officiel CP/RTT/RECUPERATION_HEURES ou colonnes legacy).",
      );
      severity = "error";
    }
    if (cells.balanceType && !balanceType) {
      messages.push(
        "Type de solde inconnu (attendu CP, RTT, RECUPERATION_HEURES).",
      );
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
    const verifNorm = verificationStatus
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (
      verifNorm !== "verifie" &&
      verifNorm !== "verifie par rh" &&
      verifNorm !== "verified"
    ) {
      messages.push(
        "Statut de vérification RH non confirmé — à contrôler avant exécution.",
      );
      if (severity === "ok") severity = "warning";
    }

    return {
      rowNumber: row.rowNumber,
      matricule,
      employeeId: matricule && knownIds.has(matricule) ? matricule : null,
      balanceType,
      balanceAmount,
      balanceUnit:
        balanceUnit ??
        (recoveryHours != null ? "heures" : cpDays != null || rttDays != null ? "jours" : null),
      cpDays,
      rttDays,
      recoveryHours,
      recoveryDays: null,
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
    // Totaux récupération exprimés en heures (modèle officiel) — pas de conversion jours.
    openingRecoveryDaysTotal: validBal.reduce(
      (s, b) => s + (b.recoveryHours ?? b.recoveryDays ?? 0),
      0,
    ),
  };
}
