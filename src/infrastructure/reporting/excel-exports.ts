import {
  APPROVED_LEAVE_STATUS,
  PENDING_LEAVE_STATUSES,
  isoInRange,
  moroccoCalendarDayFromIso,
  type ReportExportKey,
  type ReportFilters,
} from "@/domain/rules/reporting";
import type { AppContainer } from "@/infrastructure/container";
import {
  loadReportingContext,
  type ReportingContext,
} from "@/application/services/reporting-service";
import {
  createStyledWorkbook,
  formatNumberFr,
} from "@/infrastructure/reporting/excel-workbook";
import { fullName } from "@/lib/utils";

export async function buildWorkbook(
  container: AppContainer,
  key: ReportExportKey,
  filters: ReportFilters,
): Promise<{ buffer: Buffer; rowCount: number }> {
  const ctx = await loadReportingContext(container, filters);
  switch (key) {
    case "conges_mois":
      return exportConges(container, ctx, filters);
    case "planning_absences":
      return exportPlanningAbsences(container, ctx, filters);
    case "soldes":
      return exportSoldes(container, ctx, filters);
    case "teletravail":
      return exportTeletravail(container, ctx, filters);
    case "annuaire":
      return exportAnnuaire(ctx);
    case "recrutement":
      return exportRecrutement(container, ctx, filters);
    case "documents":
      return exportDocuments(container, ctx, filters);
    case "travail_ferie":
      return exportTravailFerie(container, ctx, filters);
    case "lifecycle":
      return exportLifecycle(ctx);
    case "historique":
      return exportHistorique(container, ctx, filters);
    case "arrets_absences":
      return exportArretsAbsences(container, ctx, filters);
    default: {
      const _exhaustive: never = key;
      throw new Error(`Export inconnu: ${_exhaustive}`);
    }
  }
}

async function exportConges(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const leaves = (await container.hr.listLeaveRequests()).filter((r) =>
    ctx.scopedIds.has(r.employeeId),
  );
  const rows = leaves
    .filter(
      (r) =>
        ctx.leaveOverlapsPeriod(r, filters.startDate, filters.endDate) ||
        isoInRange(r.createdAt, filters.startDate, filters.endDate),
    )
    .map((r) => {
      const emp = ctx.byId.get(r.employeeId);
      return {
        employeeId: r.employeeId,
        employee: ctx.employeeName(r.employeeId),
        department: ctx.departmentOf(r.employeeId),
        type: ctx.labels.leaveType(r.type),
        startDate: r.startDate,
        endDate: r.endDate,
        duration: formatNumberFr(r.daysCount, 1),
        submittedAt: moroccoCalendarDayFromIso(r.createdAt),
        status: ctx.labels.status(r.status),
        decisionDate: ctx.leaveDecisionDate(r) ?? "",
        confirmedAbsence:
          r.status === APPROVED_LEAVE_STATUS ? "Oui (approuvée)" : "Non",
        employmentStatus: emp
          ? ctx.labels.employment(emp.employmentStatus)
          : "",
      };
    });

  return createStyledWorkbook(
    "Congés",
    [
      { header: "Identifiant collaborateur", key: "employeeId", width: 22 },
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Département / équipe", key: "department", width: 22 },
      { header: "Type d'absence", key: "type", width: 18 },
      { header: "Date début", key: "startDate", width: 14 },
      { header: "Date fin", key: "endDate", width: 14 },
      { header: "Durée (jours)", key: "duration", width: 14 },
      { header: "Date de demande", key: "submittedAt", width: 14 },
      { header: "Statut", key: "status", width: 20 },
      { header: "Date de décision", key: "decisionDate", width: 14 },
      { header: "Absence confirmée", key: "confirmedAbsence", width: 18 },
      { header: "Statut collaborateur", key: "employmentStatus", width: 16 },
    ],
    rows,
  );
}

async function exportPlanningAbsences(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const leaves = (await container.hr.listLeaveRequests()).filter(
    (r) =>
      ctx.scopedIds.has(r.employeeId) &&
      r.status === APPROVED_LEAVE_STATUS &&
      ctx.leaveOverlapsPeriod(r, filters.startDate, filters.endDate),
  );
  const rows = leaves.map((r) => ({
    employee: ctx.employeeName(r.employeeId),
    department: ctx.departmentOf(r.employeeId),
    type: ctx.labels.leaveType(r.type),
    startDate: r.startDate,
    endDate: r.endDate,
    duration: formatNumberFr(r.daysCount, 1),
    status: ctx.labels.status(r.status),
  }));
  return createStyledWorkbook(
    "Planning absences",
    [
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Département", key: "department", width: 22 },
      { header: "Type d'absence", key: "type", width: 18 },
      { header: "Date début", key: "startDate", width: 14 },
      { header: "Date fin", key: "endDate", width: 14 },
      { header: "Durée (jours)", key: "duration", width: 14 },
      { header: "Statut", key: "status", width: 16 },
    ],
    rows,
  );
}

async function exportSoldes(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const year = Number(filters.endDate.slice(0, 4));
  const { createLeaveLedgerService } = await import(
    "@/application/services/leave-ledger-service"
  );
  const ledger = createLeaveLedgerService({ hr: container.hr });
  await ledger.ensureBackfill(year);
  const rows = [];
  for (const emp of ctx.employees) {
    const [entries, requests, credits] = await Promise.all([
      container.hr.listLeaveLedgerEntries({ employeeId: emp.id, year }),
      container.hr.listLeaveRequests({ employeeId: emp.id }),
      container.hr.listRecoveryCredits(emp.id),
    ]);
    const { computeAccountBalance, computeCpPooledBalance } = await import(
      "@/domain/rules/leave-ledger-balance"
    );
    const cp = computeCpPooledBalance({
      employeeId: emp.id,
      year,
      entries,
      leaveRequests: requests,
    });
    const rtt = computeAccountBalance({
      employeeId: emp.id,
      account: "rtt",
      year,
      entries,
      leaveRequests: requests,
    });
    const recovery = computeAccountBalance({
      employeeId: emp.id,
      account: "recuperation",
      year,
      entries,
      leaveRequests: requests,
    });
    const recoveryHours = credits.reduce((s, c) => s + c.hoursConfirmed, 0);
    rows.push({
      employee: fullName(emp.firstName, emp.lastName),
      department: ctx.departmentOf(emp.id),
      status: ctx.labels.employment(emp.employmentStatus),
      year,
      cpAcquis: formatNumberFr(cp.totalCredited, 1),
      cpPris: formatNumberFr(cp.totalConsumed, 1),
      cpRestant: formatNumberFr(cp.ledgerBalance, 1),
      rttAcquis: formatNumberFr(rtt.totalCredited, 1),
      rttPris: formatNumberFr(rtt.totalConsumed, 1),
      rttRestant: formatNumberFr(rtt.ledgerBalance, 1),
      recoveryAcquis: formatNumberFr(recovery.totalCredited, 2),
      recoveryPris: formatNumberFr(recovery.totalConsumed, 2),
      recoveryRestant: formatNumberFr(recovery.ledgerBalance, 2),
      recoveryHoursLedger: formatNumberFr(recoveryHours, 2),
    });
  }
  return createStyledWorkbook(
    "Soldes",
    [
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Département", key: "department", width: 22 },
      { header: "Statut collaborateur", key: "status", width: 16 },
      { header: "Année", key: "year", width: 10 },
      { header: "CP acquis", key: "cpAcquis", width: 12 },
      { header: "CP pris", key: "cpPris", width: 12 },
      { header: "CP restant", key: "cpRestant", width: 12 },
      { header: "RTT annuels acquis", key: "rttAcquis", width: 16 },
      { header: "RTT annuels pris", key: "rttPris", width: 14 },
      { header: "RTT annuels restant", key: "rttRestant", width: 16 },
      {
        header: "Récupération compensatrice acquise (jours)",
        key: "recoveryAcquis",
        width: 28,
      },
      {
        header: "Récupération compensatrice prise (jours)",
        key: "recoveryPris",
        width: 28,
      },
      {
        header: "Récupération compensatrice restante (jours)",
        key: "recoveryRestant",
        width: 30,
      },
      {
        header: "Heures confirmées ledger récupération",
        key: "recoveryHoursLedger",
        width: 28,
      },
    ],
    rows,
  );
}

async function exportTeletravail(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const requests = (await container.hr.listTeleworkRequests()).filter((r) =>
    ctx.scopedIds.has(r.employeeId),
  );
  const byMonth = new Map<
    string,
    {
      employeeId: string;
      month: string;
      requested: number;
      approved: number;
      pending: number;
      rejected: number;
      decisionDates: string[];
    }
  >();

  for (const r of requests) {
    const month =
      r.month ??
      (r.days[0] ? r.days[0].slice(0, 7) : moroccoCalendarDayFromIso(r.createdAt).slice(0, 7));
    if (month < filters.startDate.slice(0, 7) || month > filters.endDate.slice(0, 7)) {
      continue;
    }
    const key = `${r.employeeId}|${month}`;
    const bucket = byMonth.get(key) ?? {
      employeeId: r.employeeId,
      month,
      requested: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      decisionDates: [],
    };
    const dayCount = r.days.length || 1;
    bucket.requested += dayCount;
    if (r.status === APPROVED_LEAVE_STATUS) bucket.approved += dayCount;
    else if (PENDING_LEAVE_STATUSES.has(r.status)) bucket.pending += dayCount;
    else if (r.status === "refusee") bucket.rejected += dayCount;
    const decided = ctx.teleworkDecisionDate(r);
    if (decided) bucket.decisionDates.push(decided);
    byMonth.set(key, bucket);
  }

  const rows = [...byMonth.values()].map((b) => ({
    employee: ctx.employeeName(b.employeeId),
    department: ctx.departmentOf(b.employeeId),
    month: b.month,
    requested: b.requested,
    approved: b.approved,
    pending: b.pending,
    rejected: b.rejected,
    decisionDates: [...new Set(b.decisionDates)].join(", "),
  }));

  return createStyledWorkbook(
    "Télétravail",
    [
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Département", key: "department", width: 22 },
      { header: "Mois cible", key: "month", width: 12 },
      { header: "Jours demandés", key: "requested", width: 14 },
      { header: "Jours approuvés", key: "approved", width: 14 },
      { header: "Jours en attente", key: "pending", width: 14 },
      { header: "Jours refusés", key: "rejected", width: 14 },
      { header: "Dates de décision", key: "decisionDates", width: 22 },
    ],
    rows,
  );
}

async function exportAnnuaire(ctx: ReportingContext) {
  const rows = [];
  for (const emp of ctx.employees) {
    const account = await ctx.findAccount(emp.id);
    rows.push({
      employeeId: emp.id,
      name: fullName(emp.firstName, emp.lastName),
      department: ctx.departmentOf(emp.id),
      jobTitle: emp.jobTitle,
      status: ctx.labels.employment(emp.employmentStatus),
      role: account ? ctx.labels.role(account.role) : "—",
      hireDate: emp.hireDate,
      departureDate: emp.departureDate ?? "",
      site: emp.site,
      contractType: emp.contractType,
    });
  }
  return createStyledWorkbook(
    "Annuaire",
    [
      { header: "Identifiant", key: "employeeId", width: 22 },
      { header: "Nom", key: "name", width: 24 },
      { header: "Département / équipe", key: "department", width: 22 },
      { header: "Poste", key: "jobTitle", width: 24 },
      { header: "Statut cycle de vie", key: "status", width: 16 },
      { header: "Rôle applicatif", key: "role", width: 18 },
      { header: "Date d'embauche", key: "hireDate", width: 14 },
      { header: "Date de départ", key: "departureDate", width: 14 },
      { header: "Site", key: "site", width: 16 },
      { header: "Type de contrat", key: "contractType", width: 14 },
    ],
    rows,
  );
}

async function exportRecrutement(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const candidates = await container.hr.listRecruitmentCandidates();
  const rows = candidates
    .filter((c) => {
      if (
        filters.departmentId &&
        c.departmentId &&
        c.departmentId !== filters.departmentId
      ) {
        return false;
      }
      const day = c.submittedAt
        ? moroccoCalendarDayFromIso(c.submittedAt)
        : moroccoCalendarDayFromIso(c.createdAt);
      return day >= filters.startDate && day <= filters.endDate;
    })
    .map((c) => {
      const dept =
        ctx.departments.find((d) => d.id === c.departmentId)?.name ?? "";
      let assignment = "Non assigné";
      if (c.interviewerEmployeeId) {
        if (c.status === "entretien_planifie") assignment = "Entretien planifié";
        else if (c.status === "entretien_termine") assignment = "Entretien terminé";
        else if (c.status === "intervieweur_assigne")
          assignment = "Intervieweur assigné";
        else assignment = "Assigné";
      }
      return {
        candidate: c.fullName,
        position: c.positionTitle,
        department: dept,
        applicationDate: c.submittedAt
          ? moroccoCalendarDayFromIso(c.submittedAt)
          : moroccoCalendarDayFromIso(c.createdAt),
        status: ctx.labels.recruitmentStatus(c.status),
        decisionDate: c.decidedAt
          ? moroccoCalendarDayFromIso(c.decidedAt)
          : "",
        interviewer: c.interviewerEmployeeId
          ? ctx.employeeName(c.interviewerEmployeeId)
          : "",
        assignmentStatus: assignment,
      };
    });

  return createStyledWorkbook(
    "Recrutement",
    [
      { header: "Candidat", key: "candidate", width: 24 },
      { header: "Poste / vacance", key: "position", width: 24 },
      { header: "Département", key: "department", width: 20 },
      { header: "Date de candidature", key: "applicationDate", width: 16 },
      { header: "Statut recrutement", key: "status", width: 20 },
      { header: "Date de décision", key: "decisionDate", width: 14 },
      { header: "Intervieweur assigné", key: "interviewer", width: 22 },
      { header: "Statut assignation", key: "assignmentStatus", width: 18 },
    ],
    rows,
  );
}

async function exportDocuments(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const docs = (await container.hr.listDocumentRequests()).filter((r) =>
    ctx.scopedIds.has(r.employeeId),
  );
  const rows = docs
    .filter((r) => isoInRange(r.createdAt, filters.startDate, filters.endDate))
    .map((r) => ({
      employee: ctx.employeeName(r.employeeId),
      documentType:
        r.documentType === "autre" && r.customLabel
          ? r.customLabel
          : ctx.labels.documentType(r.documentType),
      requestDate: moroccoCalendarDayFromIso(r.createdAt),
      status: ctx.labels.documentStatus(r.status),
      processingDate:
        r.status !== "en_attente"
          ? moroccoCalendarDayFromIso(r.updatedAt)
          : "",
      publicationDate: r.publishedAt
        ? moroccoCalendarDayFromIso(r.publishedAt)
        : "",
      rejectionReason:
        r.status === "refusee" ? (r.hrMessage ?? "").slice(0, 200) : "",
    }));

  return createStyledWorkbook(
    "Documents RH",
    [
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Type de document", key: "documentType", width: 24 },
      { header: "Date de demande", key: "requestDate", width: 14 },
      { header: "Statut", key: "status", width: 20 },
      { header: "Date de traitement", key: "processingDate", width: 16 },
      { header: "Date de publication", key: "publicationDate", width: 16 },
      { header: "Motif de refus", key: "rejectionReason", width: 28 },
    ],
    rows,
  );
}

async function exportTravailFerie(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const requests = (await container.hr.listWorkOnHolidayRequests()).filter(
    (r) => ctx.scopedIds.has(r.employeeId),
  );
  const rows = [];
  for (const r of requests) {
    if (
      !isDateInHolidayFilter(r, filters.startDate, filters.endDate)
    ) {
      continue;
    }
    const credits = r.creditLedgerId
      ? await container.hr.getRecoveryCreditBySourceRequest(r.id)
      : null;
    const balance = await container.hr.getLeaveBalance(
      r.employeeId,
      Number(r.holidayDate.slice(0, 4)),
    );
    rows.push({
      employee: ctx.employeeName(r.employeeId),
      holiday: r.holidayName,
      holidayDate: r.holidayDate,
      plannedHours: formatNumberFr(r.plannedHours, 2),
      actualHours:
        r.actualHours != null ? formatNumberFr(r.actualHours, 2) : "",
      confirmedHours:
        r.confirmedHours != null ? formatNumberFr(r.confirmedHours, 2) : "",
      status: ctx.labels.workOnHolidayStatus(r.status),
      recoveryCreditDays: credits
        ? formatNumberFr(credits.daysCredited, 3)
        : "",
      creditDate: credits
        ? moroccoCalendarDayFromIso(credits.createdAt)
        : "",
      recoveryBalance: balance
        ? formatNumberFr(balance.recoveryDaysRestants, 2)
        : "",
    });
  }

  return createStyledWorkbook(
    "Travail férié",
    [
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Jour férié", key: "holiday", width: 28 },
      { header: "Date férié", key: "holidayDate", width: 14 },
      { header: "Heures planifiées", key: "plannedHours", width: 14 },
      { header: "Heures déclarées", key: "actualHours", width: 14 },
      { header: "Heures confirmées", key: "confirmedHours", width: 14 },
      { header: "Statut", key: "status", width: 28 },
      {
        header: "Crédit récupération (jours)",
        key: "recoveryCreditDays",
        width: 22,
      },
      { header: "Date du crédit", key: "creditDate", width: 14 },
      {
        header: "Solde récupération restant (jours)",
        key: "recoveryBalance",
        width: 26,
      },
    ],
    rows,
  );
}

function isDateInHolidayFilter(
  r: { holidayDate: string; createdAt: string; confirmedAt: string | null },
  start: string,
  end: string,
): boolean {
  if (r.holidayDate >= start && r.holidayDate <= end) return true;
  if (isoInRange(r.createdAt, start, end)) return true;
  if (r.confirmedAt && isoInRange(r.confirmedAt, start, end)) return true;
  return false;
}

async function exportLifecycle(ctx: ReportingContext) {
  const rows = [];
  for (const emp of ctx.employees) {
    const account = await ctx.findAccount(emp.id);
    let provisioning = "Compte absent";
    if (account) {
      provisioning = account.isActive ? "Compte actif" : "Compte désactivé";
    }
    rows.push({
      employee: fullName(emp.firstName, emp.lastName),
      hireDate: emp.hireDate,
      provisioning,
      status: ctx.labels.employment(emp.employmentStatus),
      role: account ? ctx.labels.role(account.role) : "—",
      department: ctx.departmentOf(emp.id),
      departureDate: emp.departureDate ?? "",
    });
  }
  return createStyledWorkbook(
    "Cycle de vie",
    [
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Date d'embauche", key: "hireDate", width: 14 },
      { header: "Provisionnement compte", key: "provisioning", width: 18 },
      { header: "Statut cycle de vie", key: "status", width: 16 },
      { header: "Rôle assigné", key: "role", width: 18 },
      { header: "Département", key: "department", width: 22 },
      { header: "Date de départ", key: "departureDate", width: 14 },
    ],
    rows,
  );
}

async function exportHistorique(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const [leaves, teleworks, woh] = await Promise.all([
    container.hr.listLeaveRequests(),
    container.hr.listTeleworkRequests(),
    container.hr.listWorkOnHolidayRequests(),
  ]);

  const rows: Record<string, string>[] = [];

  for (const r of leaves) {
    if (!ctx.scopedIds.has(r.employeeId)) continue;
    if (!isoInRange(r.createdAt, filters.startDate, filters.endDate)) continue;
    rows.push({
      requestType: "Congé / absence",
      employee: ctx.employeeName(r.employeeId),
      submittedAt: moroccoCalendarDayFromIso(r.createdAt),
      status: ctx.labels.status(r.status),
      decisionDate: ctx.leaveDecisionDate(r) ?? "",
      decisionMaker: "",
      detail: `${ctx.labels.leaveType(r.type)} · ${r.startDate} → ${r.endDate}`,
    });
  }

  for (const r of teleworks) {
    if (!ctx.scopedIds.has(r.employeeId)) continue;
    if (!isoInRange(r.createdAt, filters.startDate, filters.endDate)) continue;
    rows.push({
      requestType: "Télétravail",
      employee: ctx.employeeName(r.employeeId),
      submittedAt: moroccoCalendarDayFromIso(r.createdAt),
      status: ctx.labels.status(r.status),
      decisionDate: ctx.teleworkDecisionDate(r) ?? "",
      decisionMaker: "",
      detail: r.month ?? r.days.join(", "),
    });
  }

  for (const r of woh) {
    if (!ctx.scopedIds.has(r.employeeId)) continue;
    if (!isoInRange(r.createdAt, filters.startDate, filters.endDate)) continue;
    rows.push({
      requestType: "Travail férié",
      employee: ctx.employeeName(r.employeeId),
      submittedAt: moroccoCalendarDayFromIso(r.createdAt),
      status: ctx.labels.workOnHolidayStatus(r.status),
      decisionDate: r.decidedAt
        ? moroccoCalendarDayFromIso(r.decidedAt)
        : "",
      decisionMaker: r.decidedByEmployeeId
        ? ctx.employeeName(r.decidedByEmployeeId)
        : r.confirmedByEmployeeId
          ? ctx.employeeName(r.confirmedByEmployeeId)
          : "",
      detail: `${r.holidayName} (${r.holidayDate})`,
    });
  }

  rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return createStyledWorkbook(
    "Historique demandes",
    [
      { header: "Type de demande", key: "requestType", width: 18 },
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Date de soumission", key: "submittedAt", width: 14 },
      { header: "Statut", key: "status", width: 24 },
      { header: "Date de décision", key: "decisionDate", width: 14 },
      { header: "Décideur", key: "decisionMaker", width: 22 },
      { header: "Détail", key: "detail", width: 36 },
    ],
    rows,
  );
}

async function exportArretsAbsences(
  container: AppContainer,
  ctx: ReportingContext,
  filters: ReportFilters,
) {
  const { workAbsenceCategoryLabel, workAbsenceStatusLabel } = await import(
    "@/domain/rules/work-absence"
  );
  const absences = (await container.hr.listWorkAbsences()).filter((r) =>
    ctx.scopedIds.has(r.employeeId),
  );
  const rows = absences
    .filter(
      (r) =>
        (r.startDate <= filters.endDate && r.endDate >= filters.startDate) ||
        isoInRange(r.createdAt, filters.startDate, filters.endDate),
    )
    .map((r) => ({
      employee: ctx.employeeName(r.employeeId),
      department: ctx.departmentOf(r.employeeId),
      family: r.family === "conge_special" ? "Congé spécial" : "Arrêt",
      category: workAbsenceCategoryLabel(r.category),
      startDate: r.startDate,
      endDate: r.endDate,
      days: formatNumberFr(r.daysCount, 1),
      status: workAbsenceStatusLabel(r.status),
      documentsReceived: r.documentsReceived ? "Oui" : "Non",
      payrollMonth: r.payrollProcessingMonth ?? "",
      expectedReturn: r.expectedReturnDate ?? "",
      actualReturn: r.actualReturnDate ?? "",
      returnVisitRequired: r.returnVisitRequired ? "Oui" : "Non",
      returnVisitStatus: r.returnVisitStatus,
      requiresHrReview: r.requiresHrReview ? "Oui" : "Non",
      dateGapFlag: r.dateGapFlag ? "Oui" : "Non",
      recurrenceFlag: r.recurrenceWithin3MonthsFlag ? "Oui" : "Non",
    }));

  return createStyledWorkbook(
    "Arrêts & absences",
    [
      { header: "Collaborateur", key: "employee", width: 24 },
      { header: "Département", key: "department", width: 20 },
      { header: "Famille", key: "family", width: 14 },
      { header: "Catégorie", key: "category", width: 28 },
      { header: "Début", key: "startDate", width: 12 },
      { header: "Fin", key: "endDate", width: 12 },
      { header: "Jours", key: "days", width: 10 },
      { header: "Statut", key: "status", width: 22 },
      { header: "Justificatif reçu", key: "documentsReceived", width: 16 },
      { header: "Mois paie cible", key: "payrollMonth", width: 14 },
      { header: "Retour prévu", key: "expectedReturn", width: 14 },
      { header: "Retour effectif", key: "actualReturn", width: 14 },
      { header: "Visite reprise requise", key: "returnVisitRequired", width: 18 },
      { header: "Statut visite", key: "returnVisitStatus", width: 14 },
      { header: "Revue RH", key: "requiresHrReview", width: 12 },
      { header: "Écart prolongation", key: "dateGapFlag", width: 16 },
      { header: "Rechute < 3 mois", key: "recurrenceFlag", width: 14 },
    ],
    rows,
  );
}
