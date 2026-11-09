import {
  APPROVED_LEAVE_STATUS,
  OPEN_DOCUMENT_STATUSES,
  OPEN_RECRUITMENT,
  PENDING_LEAVE_STATUSES,
  assertRangeWithinLimit,
  isDateInRange,
  isoInRange,
  moroccoCalendarDayFromIso,
  moroccoToday,
  moroccoYearMonth,
  reportFilename,
  reportExportLabel,
  resolveReportPeriod,
  type ReportExportKey,
  type ReportFilters,
  type ReportPeriodPreset,
  type ReportingKpis,
} from "@/domain/rules/reporting";
import { leaveTypeLabel } from "@/domain/rules/leave";
import { statusLabel } from "@/domain/rules/approvals";
import { employmentStatusLabel } from "@/domain/rules/lifecycle";
import { roleLabel, canAccessHrReporting } from "@/domain/rules/permissions";
import { teleworkTypeLabel } from "@/domain/rules/telework";
import {
  documentRequestStatusLabel,
  documentRequestTypeLabel,
} from "@/domain/rules/document-requests";
import { recruitmentStatusLabel } from "@/domain/rules/recruitment";
import { workOnHolidayStatusLabel } from "@/domain/rules/work-on-holiday";
import type {
  DocumentRequest,
  Employee,
  LeaveRequest,
  OrganizationUnit,
  RecoveryCreditLedgerEntry,
  RecruitmentCandidate,
  RequestStatus,
  TeleworkRequest,
} from "@/domain/types/hr";
import { AuthError } from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import { findAccountByEmployeeId } from "@/infrastructure/auth/account-store";
import type { AppContainer } from "@/infrastructure/container";
import { fullName } from "@/lib/utils";

export type ChartBucket = { key: string; label: string; value: number };

export type ReportingDashboard = {
  filters: ReportFilters;
  kpis: ReportingKpis;
  charts: {
    workforceByDepartment: ChartBucket[];
    absenceDaysByMonth: ChartBucket[];
    leaveStatusDistribution: ChartBucket[];
    teleworkDaysByMonth: ChartBucket[];
    recruitmentByStatus: ChartBucket[];
    documentRequestsByStatus: ChartBucket[];
  };
  employees: Employee[];
  departments: OrganizationUnit[];
};

export type ExportResult = {
  filename: string;
  mimeType: string;
  base64: string;
  rowCount: number;
};

function requireReporting(session: AuthSession): void {
  if (!canAccessHrReporting(session.role)) {
    throw new AuthError(
      "Accès refusé : le reporting RH est réservé aux Ressources humaines et au Chef de projet.",
    );
  }
}

function matchesEmployeeFilters(
  employee: Employee,
  filters: ReportFilters,
): boolean {
  if (filters.departmentId && employee.departmentId !== filters.departmentId) {
    return false;
  }
  if (filters.employeeId && employee.id !== filters.employeeId) {
    return false;
  }
  if (
    filters.employmentStatus &&
    employee.employmentStatus !== filters.employmentStatus
  ) {
    return false;
  }
  return true;
}

function leaveOverlapsPeriod(
  leave: LeaveRequest,
  start: string,
  end: string,
): boolean {
  return leave.startDate <= end && leave.endDate >= start;
}

function leaveDecisionDate(leave: LeaveRequest): string | null {
  if (leave.status === "approuvee" || leave.status === "refusee") {
    return moroccoCalendarDayFromIso(leave.updatedAt);
  }
  return null;
}

function teleworkDecisionDate(tw: TeleworkRequest): string | null {
  if (tw.status === "approuvee" || tw.status === "refusee") {
    return moroccoCalendarDayFromIso(tw.updatedAt);
  }
  return null;
}

function monthsBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const endKey = end.slice(0, 7);
  while (true) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    keys.push(key);
    if (key >= endKey) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function monthLabelFr(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function parseReportingFilters(input: {
  preset?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  departmentId?: string | null;
  employeeId?: string | null;
  employmentStatus?: string | null;
  requestStatus?: string | null;
}): ReportFilters {
  const preset = (input.preset || "ce_mois") as ReportPeriodPreset;
  const allowed: ReportPeriodPreset[] = [
    "ce_mois",
    "mois_precedent",
    "ce_trimestre",
    "cette_annee",
    "personnalise",
  ];
  if (!allowed.includes(preset)) {
    throw new Error("Période de reporting invalide.");
  }
  const period = resolveReportPeriod(
    preset,
    input.startDate,
    input.endDate,
  );
  assertRangeWithinLimit(period.startDate, period.endDate);

  const employmentStatus =
    input.employmentStatus === "actif" ||
    input.employmentStatus === "inactif" ||
    input.employmentStatus === "parti"
      ? input.employmentStatus
      : null;

  return {
    ...period,
    departmentId: input.departmentId?.trim() || null,
    employeeId: input.employeeId?.trim() || null,
    employmentStatus,
    requestStatus: input.requestStatus?.trim() || null,
  };
}

export function createReportingService(container: AppContainer) {
  async function loadScopedEmployees(filters: ReportFilters) {
    const [employees, departments] = await Promise.all([
      container.hr.listEmployees({ includeInactive: true }),
      container.hr.listDepartments(),
    ]);
    const scoped = employees.filter((e) => matchesEmployeeFilters(e, filters));
    const scopedIds = new Set(scoped.map((e) => e.id));
    return { employees: scoped, allEmployees: employees, departments, scopedIds };
  }

  async function getDashboard(
    session: AuthSession,
    rawFilters: Parameters<typeof parseReportingFilters>[0],
  ): Promise<ReportingDashboard> {
    requireReporting(session);
    const filters = parseReportingFilters(rawFilters);
    const { employees, departments, scopedIds } =
      await loadScopedEmployees(filters);

    const [
      leaveRequests,
      teleworkRequests,
      documentRequests,
      candidates,
      wohRequests,
    ] = await Promise.all([
      container.hr.listLeaveRequests(),
      container.hr.listTeleworkRequests(),
      container.hr.listDocumentRequests(),
      container.hr.listRecruitmentCandidates(),
      container.hr.listWorkOnHolidayRequests(),
    ]);

    const leaves = leaveRequests.filter((r) => scopedIds.has(r.employeeId));
    const teleworks = teleworkRequests.filter((r) =>
      scopedIds.has(r.employeeId),
    );
    const docs = documentRequests.filter((r) => scopedIds.has(r.employeeId));
    const woh = wohRequests.filter((r) => scopedIds.has(r.employeeId));

    const statusFilter = filters.requestStatus;

    const leavesInPeriod = leaves.filter((r) =>
      isoInRange(r.createdAt, filters.startDate, filters.endDate),
    );
    const leavesForStatusChart = statusFilter
      ? leavesInPeriod.filter((r) => r.status === statusFilter)
      : leavesInPeriod;

    const approvedAbsences = leaves.filter(
      (r) =>
        r.status === APPROVED_LEAVE_STATUS &&
        leaveOverlapsPeriod(r, filters.startDate, filters.endDate),
    );

    const pendingLeave = leaves.filter((r) =>
      PENDING_LEAVE_STATUSES.has(r.status),
    );
    const pendingTw = teleworks.filter((r) =>
      PENDING_LEAVE_STATUSES.has(r.status),
    );
    const pendingWoh = woh.filter((r) => r.status === "en_attente");
    const pendingDocs = docs.filter((r) => OPEN_DOCUMENT_STATUSES.has(r.status));

    const twInPeriod = teleworks.filter((r) =>
      isoInRange(r.createdAt, filters.startDate, filters.endDate),
    );

    const recoveryEntries: RecoveryCreditLedgerEntry[] = [];
    for (const emp of employees) {
      const credits = await container.hr.listRecoveryCredits(emp.id);
      for (const c of credits) {
        if (isoInRange(c.createdAt, filters.startDate, filters.endDate)) {
          recoveryEntries.push(c);
        }
      }
    }

    const kpis: ReportingKpis = {
      effectifActif: employees.filter((e) => e.employmentStatus === "actif")
        .length,
      nouveauxCollaborateurs: employees.filter((e) =>
        isDateInRange(e.hireDate, filters.startDate, filters.endDate),
      ).length,
      departs: employees.filter(
        (e) =>
          e.departureDate != null &&
          isDateInRange(e.departureDate, filters.startDate, filters.endDate),
      ).length,
      collaborateursInactifs: employees.filter(
        (e) => e.employmentStatus === "inactif",
      ).length,
      demandesConges: leavesInPeriod.length,
      absencesApprouveesJours: approvedAbsences.reduce(
        (sum, r) => sum + r.daysCount,
        0,
      ),
      demandesCongesApprouvees: approvedAbsences.length,
      demandesEnAttente:
        pendingLeave.length +
        pendingTw.length +
        pendingWoh.length +
        pendingDocs.length,
      demandesTeletravail: twInPeriod.length,
      demandesDocumentsEnAttente: pendingDocs.length,
      recrutementsEnCours: candidates.filter((c) =>
        OPEN_RECRUITMENT.has(c.status),
      ).length,
      recuperationCrediteeHeures: recoveryEntries.reduce(
        (s, c) => s + c.hoursConfirmed,
        0,
      ),
      recuperationCrediteeJours: recoveryEntries.reduce(
        (s, c) => s + c.daysCredited,
        0,
      ),
    };

    const workforceByDepartment: ChartBucket[] = departments
      .map((d) => ({
        key: d.id,
        label: d.name,
        value: employees.filter(
          (e) => e.departmentId === d.id && e.employmentStatus === "actif",
        ).length,
      }))
      .filter((b) => b.value > 0);

    const monthKeys = monthsBetween(filters.startDate, filters.endDate);
    const absenceDaysByMonth: ChartBucket[] = monthKeys.map((key) => {
      const value = approvedAbsences
        .filter((r) => moroccoYearMonth(r.startDate) === key)
        .reduce((s, r) => s + r.daysCount, 0);
      return { key, label: monthLabelFr(key), value };
    });

    const statusCounts = new Map<string, number>();
    for (const r of leavesForStatusChart) {
      statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
    }
    const leaveStatusDistribution: ChartBucket[] = [
      ...statusCounts.entries(),
    ].map(([key, value]) => ({
      key,
      label: statusLabel(key as RequestStatus),
      value,
    }));

    const teleworkDaysByMonth: ChartBucket[] = monthKeys.map((monthKey) => {
      let value = 0;
      for (const r of teleworks) {
        if (r.status !== APPROVED_LEAVE_STATUS) continue;
        for (const day of r.days) {
          if (
            moroccoYearMonth(day) === monthKey &&
            isDateInRange(day, filters.startDate, filters.endDate)
          ) {
            value += 1;
          }
        }
      }
      return { key: monthKey, label: monthLabelFr(monthKey), value };
    });

    const recruitmentCounts = new Map<string, number>();
    for (const c of candidates) {
      if (
        filters.departmentId &&
        c.departmentId &&
        c.departmentId !== filters.departmentId
      ) {
        continue;
      }
      recruitmentCounts.set(
        c.status,
        (recruitmentCounts.get(c.status) ?? 0) + 1,
      );
    }
    const recruitmentByStatus: ChartBucket[] = [
      ...recruitmentCounts.entries(),
    ].map(([key, value]) => ({
      key,
      label: recruitmentStatusLabel(
        key as RecruitmentCandidate["status"],
      ),
      value,
    }));

    const docCounts = new Map<string, number>();
    for (const d of docs) {
      if (!isoInRange(d.createdAt, filters.startDate, filters.endDate)) continue;
      docCounts.set(d.status, (docCounts.get(d.status) ?? 0) + 1);
    }
    const documentRequestsByStatus: ChartBucket[] = [
      ...docCounts.entries(),
    ].map(([key, value]) => ({
      key,
      label: documentRequestStatusLabel(
        key as DocumentRequest["status"],
      ),
      value,
    }));

    return {
      filters,
      kpis,
      charts: {
        workforceByDepartment,
        absenceDaysByMonth,
        leaveStatusDistribution,
        teleworkDaysByMonth,
        recruitmentByStatus,
        documentRequestsByStatus,
      },
      employees,
      departments,
    };
  }

  async function logExport(
    session: AuthSession,
    key: ReportExportKey,
    rowCount: number,
  ) {
    await container.hr.addNotification({
      recipientId: session.employee.id,
      title: "Export Excel reporting",
      body: `${reportExportLabel(key)} — ${rowCount} ligne(s) — ${moroccoToday()}`,
      href: "/administration/rapports",
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    getDashboard,

    async exportReport(
      session: AuthSession,
      key: ReportExportKey,
      rawFilters: Parameters<typeof parseReportingFilters>[0],
    ): Promise<ExportResult> {
      requireReporting(session);
      const filters = parseReportingFilters(rawFilters);
      const { buildWorkbook } = await import(
        "@/infrastructure/reporting/excel-exports"
      );
      const result = await buildWorkbook(container, key, filters);
      const filename = reportFilename(key, moroccoToday());
      await logExport(session, key, result.rowCount);
      return {
        filename,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: Buffer.from(result.buffer).toString("base64"),
        rowCount: result.rowCount,
      };
    },
  };
}

export async function loadReportingContext(
  container: AppContainer,
  filters: ReportFilters,
) {
  const [employees, departments] = await Promise.all([
    container.hr.listEmployees({ includeInactive: true }),
    container.hr.listDepartments(),
  ]);
  const scoped = employees.filter((e) => matchesEmployeeFilters(e, filters));
  const byId = new Map(employees.map((e) => [e.id, e]));
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]));
  return {
    employees: scoped,
    allEmployees: employees,
    departments,
    scopedIds: new Set(scoped.map((e) => e.id)),
    employeeName: (id: string) => {
      const e = byId.get(id);
      return e ? fullName(e.firstName, e.lastName) : id;
    },
    departmentOf: (employeeId: string) => {
      const e = byId.get(employeeId);
      if (!e) return "";
      return deptById[e.departmentId]?.name ?? e.departmentId;
    },
    byId,
    leaveDecisionDate,
    teleworkDecisionDate,
    leaveOverlapsPeriod,
    labels: {
      leaveType: leaveTypeLabel,
      status: statusLabel,
      employment: employmentStatusLabel,
      role: roleLabel,
      teleworkType: teleworkTypeLabel,
      documentType: documentRequestTypeLabel,
      documentStatus: documentRequestStatusLabel,
      recruitmentStatus: recruitmentStatusLabel,
      workOnHolidayStatus: workOnHolidayStatusLabel,
    },
    findAccount: findAccountByEmployeeId,
  };
}

export type ReportingContext = Awaited<
  ReturnType<typeof loadReportingContext>
>;
