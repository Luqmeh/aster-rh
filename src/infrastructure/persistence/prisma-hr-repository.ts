import type { LeaveRequest } from "@/domain/types/hr";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import { getPrismaClient } from "@/infrastructure/persistence/prisma-client";
import {
  dateOnlyToUtc,
  mapDocument,
  mapEmployee,
  mapLeaveBalance,
  mapLeaveLedgerEntry,
  mapLeaveRequest,
  mapNotification,
  mapOrganizationUnit,
  mapTeleworkRequest,
} from "@/infrastructure/persistence/prisma-mappers";

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function teamEmployeeIds(managerId: string): Promise<string[]> {
  const prisma = getPrismaClient();
  const team = await prisma.employee.findMany({
    where: { managerId, isActive: true },
    select: { id: true },
  });
  return team.map((e) => e.id);
}

export const prismaHrRepository: HrRepository = {
  async listDepartments() {
    const rows = await getPrismaClient().organizationUnit.findMany({
      orderBy: { name: "asc" },
    });
    return rows.map(mapOrganizationUnit);
  },

  async listEmployees(filter) {
    const where = filter?.employmentStatus
      ? {
          employmentStatus: Array.isArray(filter.employmentStatus)
            ? { in: filter.employmentStatus }
            : filter.employmentStatus,
        }
      : filter?.includeInactive
        ? undefined
        : { isActive: true };
    const rows = await getPrismaClient().employee.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map(mapEmployee);
  },

  async getEmployee(id) {
    const row = await getPrismaClient().employee.findUnique({ where: { id } });
    return row ? mapEmployee(row) : null;
  },

  async getEmployeeByEmail(email) {
    const row = await getPrismaClient().employee.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? mapEmployee(row) : null;
  },

  async createEmployee(input) {
    const { dateOnlyToUtc } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const { syncIsActive } = await import("@/domain/rules/lifecycle");
    const employmentStatus = input.employmentStatus ?? "actif";
    try {
      const row = await getPrismaClient().employee.create({
        data: {
          id: input.id,
          demoIdentityId: input.demoIdentityId ?? `provisioned-${input.id}`,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.trim().toLowerCase(),
          jobTitle: input.jobTitle,
          departmentId: input.departmentId,
          managerId: input.managerId,
          site: input.site,
          contractType: input.contractType,
          category: input.category,
          hireDate: dateOnlyToUtc(input.hireDate),
          employmentStatus,
          departureDate: input.departureDate
            ? dateOnlyToUtc(input.departureDate)
            : null,
          departureNote: input.departureNote ?? null,
          isActive: syncIsActive(employmentStatus),
          phoneInternal: input.phoneInternal ?? null,
          avatarInitials:
            input.avatarInitials ??
            `${input.firstName.charAt(0)}${input.lastName.charAt(0)}`.toUpperCase(),
          teleworkEligible: input.teleworkEligible ?? true,
          teleworkDaysPerWeek: input.teleworkDaysPerWeek ?? 2,
          standardDailyHours: input.standardDailyHours ?? 7,
          isPartTime: input.isPartTime ?? false,
          weeklyContractHours: input.weeklyContractHours ?? null,
          workingTimePercent: input.workingTimePercent ?? null,
          officeCalendarId: input.officeCalendarId ?? null,
          policyGroup: input.policyGroup ?? null,
          birthDate: input.birthDate
            ? dateOnlyToUtc(input.birthDate)
            : null,
          activitySector: input.activitySector ?? "non_agricole",
        },
      });
      return mapEmployee(row);
    } catch {
      throw new Error(
        "Impossible de créer le collaborateur (identifiant ou e-mail déjà utilisé).",
      );
    }
  },

  async updateEmployee(id, patch) {
    const { dateOnlyToUtc } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const { syncIsActive } = await import("@/domain/rules/lifecycle");
    const data: Record<string, unknown> = { ...patch };
    if (typeof patch.hireDate === "string") {
      data.hireDate = dateOnlyToUtc(patch.hireDate);
    }
    if (typeof patch.departureDate === "string") {
      data.departureDate = dateOnlyToUtc(patch.departureDate);
    } else if (patch.departureDate === null) {
      data.departureDate = null;
    }
    if (typeof patch.birthDate === "string") {
      data.birthDate = dateOnlyToUtc(patch.birthDate);
    } else if (patch.birthDate === null) {
      data.birthDate = null;
    }
    if (typeof patch.activitySector === "string") {
      data.activitySector = patch.activitySector;
    }
    if (patch.employmentStatus) {
      data.isActive = syncIsActive(patch.employmentStatus);
    }
    const row = await getPrismaClient().employee.update({
      where: { id },
      data,
    });
    return mapEmployee(row);
  },

  async listTeamMembers(managerId) {
    const rows = await getPrismaClient().employee.findMany({
      where: { managerId, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map(mapEmployee);
  },

  async getLeaveBalance(employeeId, year) {
    const row = await getPrismaClient().leaveBalance.findUnique({
      where: { employeeId_year: { employeeId, year } },
    });
    return row ? mapLeaveBalance(row) : null;
  },

  async listLeaveBalances(year) {
    const rows = await getPrismaClient().leaveBalance.findMany({
      where: year != null ? { year } : undefined,
      orderBy: [{ employeeId: "asc" }, { year: "asc" }],
    });
    return rows.map(mapLeaveBalance);
  },

  async listLeaveLedgerEntries(filter) {
    const rows = await getPrismaClient().leaveLedgerEntry.findMany({
      where: {
        employeeId: filter?.employeeId,
        account: filter?.account,
        year: filter?.year,
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapLeaveLedgerEntry);
  },

  async getLeaveLedgerEntryBySource(input) {
    const row = await getPrismaClient().leaveLedgerEntry.findUnique({
      where: {
        sourceKind_sourceId_transactionType: {
          sourceKind: input.sourceKind,
          sourceId: input.sourceId,
          transactionType: input.transactionType,
        },
      },
    });
    return row ? mapLeaveLedgerEntry(row) : null;
  },

  async appendLeaveLedgerEntry(input) {
    const prisma = getPrismaClient();
    const existing = await prisma.leaveLedgerEntry.findUnique({
      where: {
        sourceKind_sourceId_transactionType: {
          sourceKind: input.sourceKind,
          sourceId: input.sourceId,
          transactionType: input.transactionType,
        },
      },
    });
    if (existing) {
      return { entry: mapLeaveLedgerEntry(existing), created: false };
    }
    try {
      const row = await prisma.leaveLedgerEntry.create({
        data: {
          id: input.id,
          employeeId: input.employeeId,
          account: input.account,
          transactionType: input.transactionType,
          quantity: input.quantity,
          unit: input.unit ?? "days",
          year: input.year,
          effectiveDate: new Date(`${input.effectiveDate}T00:00:00.000Z`),
          sourceKind: input.sourceKind,
          sourceId: input.sourceId,
          reason: input.reason,
          actorEmployeeId: input.actorEmployeeId ?? null,
          reversesEntryId: input.reversesEntryId ?? null,
          metadataJson: input.metadataJson
            ? (JSON.parse(
                JSON.stringify(input.metadataJson),
              ) as import("@prisma/client/runtime/library").InputJsonValue)
            : undefined,
        },
      });
      return { entry: mapLeaveLedgerEntry(row), created: true };
    } catch (error) {
      // Course concurrente : unique violation → relire
      const again = await prisma.leaveLedgerEntry.findUnique({
        where: {
          sourceKind_sourceId_transactionType: {
            sourceKind: input.sourceKind,
            sourceId: input.sourceId,
            transactionType: input.transactionType,
          },
        },
      });
      if (again) {
        return { entry: mapLeaveLedgerEntry(again), created: false };
      }
      throw error;
    }
  },

  async listLeaveRequests(filter) {
    const prisma = getPrismaClient();
    const where: {
      employeeId?: string | { in: string[] };
      status?: LeaveRequest["status"];
    } = {};

    if (filter?.employeeId) {
      where.employeeId = filter.employeeId;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.managerId) {
      const ids = await teamEmployeeIds(filter.managerId);
      where.employeeId = { in: ids };
    }

    const rows = await prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapLeaveRequest);
  },

  async getLeaveRequest(id) {
    const row = await getPrismaClient().leaveRequest.findUnique({
      where: { id },
    });
    return row ? mapLeaveRequest(row) : null;
  },

  async createLeaveRequest(input) {
    const id = newId("leave");
    const row = await getPrismaClient().leaveRequest.create({
      data: {
        id,
        employeeId: input.employeeId,
        type: input.type,
        startDate: dateOnlyToUtc(input.startDate),
        endDate: dateOnlyToUtc(input.endDate),
        halfDayStart: input.halfDayStart,
        halfDayEnd: input.halfDayEnd,
        daysCount: input.daysCount,
        status: input.status,
        comment: input.comment,
        managerComment: input.managerComment,
      },
    });
    return mapLeaveRequest(row);
  },

  async updateLeaveRequest(id, patch) {
    const data: Record<string, unknown> = {};
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.startDate !== undefined) {
      data.startDate = dateOnlyToUtc(patch.startDate);
    }
    if (patch.endDate !== undefined) {
      data.endDate = dateOnlyToUtc(patch.endDate);
    }
    if (patch.halfDayStart !== undefined) data.halfDayStart = patch.halfDayStart;
    if (patch.halfDayEnd !== undefined) data.halfDayEnd = patch.halfDayEnd;
    if (patch.daysCount !== undefined) data.daysCount = patch.daysCount;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.comment !== undefined) data.comment = patch.comment;
    if (patch.managerComment !== undefined) {
      data.managerComment = patch.managerComment;
    }
    if (patch.employeeId !== undefined) data.employeeId = patch.employeeId;

    try {
      const row = await getPrismaClient().leaveRequest.update({
        where: { id },
        data,
      });
      return mapLeaveRequest(row);
    } catch {
      throw new Error("Demande de congés introuvable.");
    }
  },

  async listTeleworkRequests(filter) {
    const prisma = getPrismaClient();
    const where: {
      employeeId?: string | { in: string[] };
    } = {};

    if (filter?.employeeId) {
      where.employeeId = filter.employeeId;
    }
    if (filter?.managerId) {
      const ids = await teamEmployeeIds(filter.managerId);
      where.employeeId = { in: ids };
    }

    const rows = await prisma.teleworkRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapTeleworkRequest);
  },

  async getTeleworkRequest(id) {
    const row = await getPrismaClient().teleworkRequest.findUnique({
      where: { id },
    });
    return row ? mapTeleworkRequest(row) : null;
  },

  async createTeleworkRequest(input) {
    const id = newId("tw");
    const row = await getPrismaClient().teleworkRequest.create({
      data: {
        id,
        employeeId: input.employeeId,
        type: input.type,
        month: input.month,
        startDate: dateOnlyToUtc(input.startDate),
        endDate: dateOnlyToUtc(input.endDate),
        days: input.days,
        status: input.status,
        reason: input.reason,
        managerComment: input.managerComment,
      },
    });
    return mapTeleworkRequest(row);
  },

  async updateTeleworkRequest(id, patch) {
    const data: Record<string, unknown> = {};
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.month !== undefined) data.month = patch.month;
    if (patch.startDate !== undefined) {
      data.startDate = dateOnlyToUtc(patch.startDate);
    }
    if (patch.endDate !== undefined) {
      data.endDate = dateOnlyToUtc(patch.endDate);
    }
    if (patch.days !== undefined) data.days = patch.days;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.reason !== undefined) data.reason = patch.reason;
    if (patch.managerComment !== undefined) {
      data.managerComment = patch.managerComment;
    }
    if (patch.employeeId !== undefined) data.employeeId = patch.employeeId;

    try {
      const row = await getPrismaClient().teleworkRequest.update({
        where: { id },
        data,
      });
      return mapTeleworkRequest(row);
    } catch {
      throw new Error("Demande de télétravail introuvable.");
    }
  },

  async markNotificationsRead(recipientId, ids) {
    const where: {
      recipientId: string;
      read: boolean;
      id?: { in: string[] };
    } = { recipientId, read: false };
    if (ids && ids.length > 0) where.id = { in: ids };
    const result = await getPrismaClient().notificationItem.updateMany({
      where,
      data: { read: true },
    });
    return result.count;
  },

  async listNotifications(recipientId) {
    const rows = await getPrismaClient().notificationItem.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapNotification);
  },

  async addNotification(input) {
    const id = newId("notif");
    const row = await getPrismaClient().notificationItem.create({
      data: {
        id,
        recipientId: input.recipientId,
        title: input.title,
        body: input.body,
        href: input.href,
        read: input.read,
        createdAt: new Date(input.createdAt),
      },
    });
    return mapNotification(row);
  },

  async listDocuments(employeeId) {
    const rows = await getPrismaClient().hrDocument.findMany({
      where: {
        OR: [
          { isCompanyWide: true },
          ...(employeeId ? [{ employeeId }] : []),
        ],
      },
      orderBy: { uploadedAt: "desc" },
    });
    return rows.map(mapDocument);
  },

  async countAccountsByRole(role) {
    return getPrismaClient().userAccount.count({
      where: { role, isActive: true },
    });
  },

  async addRoleChangeAudit(input) {
    const row = await getPrismaClient().roleChangeAudit.create({
      data: {
        id: newId("role-audit"),
        targetAccountId: input.targetAccountId,
        previousRole: input.previousRole,
        newRole: input.newRole,
        actorEmployeeId: input.actorEmployeeId,
      },
    });
    return {
      id: row.id,
      targetAccountId: row.targetAccountId,
      previousRole: row.previousRole,
      newRole: row.newRole,
      actorEmployeeId: row.actorEmployeeId,
      createdAt: row.createdAt.toISOString(),
    };
  },

  async listRoleChangeAudits(targetAccountId) {
    const rows = await getPrismaClient().roleChangeAudit.findMany({
      where: targetAccountId ? { targetAccountId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      targetAccountId: row.targetAccountId,
      previousRole: row.previousRole,
      newRole: row.newRole,
      actorEmployeeId: row.actorEmployeeId,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async listRecruitmentCandidates(filter) {
    const { mapRecruitmentCandidate } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const where: Record<string, unknown> = {};
    if (filter?.createdByEmployeeId) {
      where.createdByEmployeeId = filter.createdByEmployeeId;
    }
    if (filter?.interviewerEmployeeId) {
      where.interviewerEmployeeId = filter.interviewerEmployeeId;
    }
    if (filter?.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
    }
    if (filter?.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { positionTitle: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await getPrismaClient().recruitmentCandidate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapRecruitmentCandidate);
  },

  async getRecruitmentCandidate(id) {
    const { mapRecruitmentCandidate } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().recruitmentCandidate.findUnique({
      where: { id },
    });
    return row ? mapRecruitmentCandidate(row) : null;
  },

  async createRecruitmentCandidate(input) {
    const { mapRecruitmentCandidate } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().recruitmentCandidate.create({
      data: {
        id: newId("rec"),
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        positionTitle: input.positionTitle,
        departmentId: input.departmentId,
        cvStorageKey: input.cvStorageKey,
        cvFileName: input.cvFileName,
        cvContentType: input.cvContentType,
        hrNotes: input.hrNotes,
        status: input.status,
        submittedAt: input.submittedAt ? new Date(input.submittedAt) : null,
        createdByEmployeeId: input.createdByEmployeeId,
        decidedByEmployeeId: input.decidedByEmployeeId,
        decisionComment: input.decisionComment,
        decidedAt: input.decidedAt ? new Date(input.decidedAt) : null,
        interviewerEmployeeId: input.interviewerEmployeeId,
        assignedByEmployeeId: input.assignedByEmployeeId,
        assignedAt: input.assignedAt ? new Date(input.assignedAt) : null,
      },
    });
    return mapRecruitmentCandidate(row);
  },

  async updateRecruitmentCandidate(id, patch) {
    const { mapRecruitmentCandidate } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const data: Record<string, unknown> = { ...patch };
    for (const key of ["submittedAt", "decidedAt", "assignedAt"] as const) {
      if (patch[key] !== undefined) {
        data[key] = patch[key] ? new Date(patch[key] as string) : null;
      }
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const row = await getPrismaClient().recruitmentCandidate.update({
      where: { id },
      data,
    });
    return mapRecruitmentCandidate(row);
  },

  async addRecruitmentEvent(input) {
    const { mapRecruitmentEvent } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().recruitmentEvent.create({
      data: {
        id: newId("recevt"),
        candidateId: input.candidateId,
        kind: input.kind,
        message: input.message,
        actorId: input.actorId,
      },
    });
    return mapRecruitmentEvent(row);
  },

  async listRecruitmentEvents(candidateId) {
    const { mapRecruitmentEvent } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const rows = await getPrismaClient().recruitmentEvent.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRecruitmentEvent);
  },

  async listDocumentRequests(filter) {
    const { mapDocumentRequest } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const where: Record<string, unknown> = {};
    if (filter?.employeeId) where.employeeId = filter.employeeId;
    if (filter?.documentType) where.documentType = filter.documentType;
    if (filter?.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
    }
    if (filter?.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { reason: { contains: q, mode: "insensitive" } },
        { customLabel: { contains: q, mode: "insensitive" } },
        {
          employee: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ];
    }
    const rows = await getPrismaClient().documentRequest.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapDocumentRequest);
  },

  async getDocumentRequest(id) {
    const { mapDocumentRequest } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().documentRequest.findUnique({
      where: { id },
    });
    return row ? mapDocumentRequest(row) : null;
  },

  async createDocumentRequest(input) {
    const { mapDocumentRequest } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().documentRequest.create({
      data: {
        id: newId("docreq"),
        employeeId: input.employeeId,
        documentType: input.documentType,
        customLabel: input.customLabel,
        reason: input.reason,
        status: input.status,
        hrMessage: input.hrMessage,
        hrInternalNote: input.hrInternalNote,
        storageKey: input.storageKey,
        fileName: input.fileName,
        contentType: input.contentType,
        published: input.published,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        processedByEmployeeId: input.processedByEmployeeId,
      },
    });
    return mapDocumentRequest(row);
  },

  async updateDocumentRequest(id, patch) {
    const { mapDocumentRequest } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const data: Record<string, unknown> = { ...patch };
    if (patch.publishedAt !== undefined) {
      data.publishedAt = patch.publishedAt
        ? new Date(patch.publishedAt)
        : null;
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const row = await getPrismaClient().documentRequest.update({
      where: { id },
      data,
    });
    return mapDocumentRequest(row);
  },

  async addDocumentRequestEvent(input) {
    const { mapDocumentRequestEvent } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().documentRequestEvent.create({
      data: {
        id: newId("docreqevt"),
        requestId: input.requestId,
        kind: input.kind,
        message: input.message,
        actorId: input.actorId,
      },
    });
    return mapDocumentRequestEvent(row);
  },

  async listDocumentRequestEvents(requestId) {
    const { mapDocumentRequestEvent } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const rows = await getPrismaClient().documentRequestEvent.findMany({
      where: { requestId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapDocumentRequestEvent);
  },

  async updateLeaveBalance(employeeId, year, patch) {
    const { mapLeaveBalance } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const existing = await getPrismaClient().leaveBalance.findUnique({
      where: { employeeId_year: { employeeId, year } },
    });
    if (!existing) {
      const row = await getPrismaClient().leaveBalance.create({
        data: {
          employeeId,
          year,
          congesPayesAcquis: patch.congesPayesAcquis ?? 0,
          congesPayesPris: patch.congesPayesPris ?? 0,
          congesPayesRestants: patch.congesPayesRestants ?? 0,
          rttAcquis: patch.rttAcquis ?? 0,
          rttPris: patch.rttPris ?? 0,
          rttRestants: patch.rttRestants ?? 0,
          recoveryDaysAcquis: patch.recoveryDaysAcquis ?? 0,
          recoveryDaysPris: patch.recoveryDaysPris ?? 0,
          recoveryDaysRestants: patch.recoveryDaysRestants ?? 0,
        },
      });
      return mapLeaveBalance(row);
    }
    const row = await getPrismaClient().leaveBalance.update({
      where: { employeeId_year: { employeeId, year } },
      data: {
        congesPayesAcquis: patch.congesPayesAcquis,
        congesPayesPris: patch.congesPayesPris,
        congesPayesRestants: patch.congesPayesRestants,
        rttAcquis: patch.rttAcquis,
        rttPris: patch.rttPris,
        rttRestants: patch.rttRestants,
        recoveryDaysAcquis: patch.recoveryDaysAcquis,
        recoveryDaysPris: patch.recoveryDaysPris,
        recoveryDaysRestants: patch.recoveryDaysRestants,
      },
    });
    return mapLeaveBalance(row);
  },

  async listHolidayOverrides(year) {
    const rows = await getPrismaClient().holidayOverride.findMany({
      where: year ? { year } : undefined,
      orderBy: { date: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceKey: row.sourceKey,
      date: row.date.toISOString().slice(0, 10),
      nameFr: row.nameFr,
      kind: row.kind,
      confirmation: row.confirmation,
      isActive: row.isActive,
      year: row.year,
      createdByEmployeeId: row.createdByEmployeeId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  async upsertHolidayOverride(input) {
    const date = new Date(`${input.date}T00:00:00.000Z`);
    const row = await getPrismaClient().holidayOverride.upsert({
      where: {
        sourceKey_year: { sourceKey: input.sourceKey, year: input.year },
      },
      create: {
        sourceKey: input.sourceKey,
        date,
        nameFr: input.nameFr,
        kind: input.kind,
        confirmation: input.confirmation,
        isActive: input.isActive,
        year: input.year,
        createdByEmployeeId: input.createdByEmployeeId,
      },
      update: {
        date,
        nameFr: input.nameFr,
        kind: input.kind,
        confirmation: input.confirmation,
        isActive: input.isActive,
        createdByEmployeeId: input.createdByEmployeeId,
      },
    });
    return {
      id: row.id,
      sourceKey: row.sourceKey,
      date: row.date.toISOString().slice(0, 10),
      nameFr: row.nameFr,
      kind: row.kind,
      confirmation: row.confirmation,
      isActive: row.isActive,
      year: row.year,
      createdByEmployeeId: row.createdByEmployeeId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  async listWorkOnHolidayRequests(filter) {
    const where: Record<string, unknown> = {};
    if (filter?.employeeId) where.employeeId = filter.employeeId;
    if (filter?.holidayDate) {
      where.holidayDate = new Date(`${filter.holidayDate}T00:00:00.000Z`);
    }
    if (filter?.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
    }
    const rows = await getPrismaClient().workOnHolidayRequest.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapWorkOnHoliday);
  },

  async getWorkOnHolidayRequest(id) {
    const row = await getPrismaClient().workOnHolidayRequest.findUnique({
      where: { id },
    });
    return row ? mapWorkOnHoliday(row) : null;
  },

  async createWorkOnHolidayRequest(input) {
    const row = await getPrismaClient().workOnHolidayRequest.create({
      data: {
        id: newId("woh"),
        employeeId: input.employeeId,
        holidayDate: new Date(`${input.holidayDate}T00:00:00.000Z`),
        holidaySourceKey: input.holidaySourceKey,
        holidayName: input.holidayName,
        plannedHours: input.plannedHours,
        plannedStart: input.plannedStart,
        plannedEnd: input.plannedEnd,
        reason: input.reason,
        status: input.status,
        decidedByEmployeeId: input.decidedByEmployeeId,
        decisionComment: input.decisionComment,
        decidedAt: input.decidedAt ? new Date(input.decidedAt) : null,
        actualHours: input.actualHours,
        actualDeclaredAt: input.actualDeclaredAt
          ? new Date(input.actualDeclaredAt)
          : null,
        confirmedHours: input.confirmedHours,
        confirmedByEmployeeId: input.confirmedByEmployeeId,
        confirmedAt: input.confirmedAt ? new Date(input.confirmedAt) : null,
        creditLedgerId: input.creditLedgerId,
      },
    });
    return mapWorkOnHoliday(row);
  },

  async updateWorkOnHolidayRequest(id, patch) {
    const data: Record<string, unknown> = { ...patch };
    if (patch.holidayDate !== undefined) {
      data.holidayDate = new Date(`${patch.holidayDate}T00:00:00.000Z`);
    }
    for (const key of [
      "decidedAt",
      "actualDeclaredAt",
      "confirmedAt",
    ] as const) {
      if (patch[key] !== undefined) {
        data[key] = patch[key] ? new Date(patch[key] as string) : null;
      }
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const row = await getPrismaClient().workOnHolidayRequest.update({
      where: { id },
      data,
    });
    return mapWorkOnHoliday(row);
  },

  async listRecoveryCredits(employeeId) {
    const rows = await getPrismaClient().recoveryCreditLedger.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRecoveryCredit);
  },

  async getRecoveryCreditBySourceRequest(sourceRequestId) {
    const row = await getPrismaClient().recoveryCreditLedger.findUnique({
      where: { sourceRequestId },
    });
    return row ? mapRecoveryCredit(row) : null;
  },

  async createRecoveryCredit(input) {
    const row = await getPrismaClient().recoveryCreditLedger.create({
      data: {
        id: newId("rcred"),
        employeeId: input.employeeId,
        year: input.year,
        sourceKind: input.sourceKind,
        sourceRequestId: input.sourceRequestId,
        hoursConfirmed: input.hoursConfirmed,
        daysCredited: input.daysCredited,
        dailyHoursUsed: input.dailyHoursUsed,
        actorEmployeeId: input.actorEmployeeId,
      },
    });
    return mapRecoveryCredit(row);
  },

  async listWorkAbsences(filter) {
    const { mapWorkAbsence } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const where: Record<string, unknown> = {};
    if (filter?.employeeId) where.employeeId = filter.employeeId;
    if (filter?.family) where.family = filter.family;
    if (filter?.category) where.category = filter.category;
    if (filter?.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
    }
    const rows = await getPrismaClient().workAbsence.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapWorkAbsence);
  },

  async getWorkAbsence(id) {
    const { mapWorkAbsence } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().workAbsence.findUnique({
      where: { id },
    });
    return row ? mapWorkAbsence(row) : null;
  },

  async createWorkAbsence(input) {
    const { mapWorkAbsence, dateOnlyToUtc } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().workAbsence.create({
      data: {
        id: newId("wabs"),
        employeeId: input.employeeId,
        family: input.family,
        category: input.category,
        status: input.status,
        startDate: dateOnlyToUtc(input.startDate),
        endDate: dateOnlyToUtc(input.endDate),
        daysCount: input.daysCount,
        employeeComment: input.employeeComment,
        hrInternalNote: input.hrInternalNote,
        hrMessage: input.hrMessage,
        rejectionReason: input.rejectionReason,
        parentAbsenceId: input.parentAbsenceId,
        recurrenceOfId: input.recurrenceOfId,
        dateGapFlag: input.dateGapFlag,
        recurrenceWithin3MonthsFlag: input.recurrenceWithin3MonthsFlag,
        requiresHrReview: input.requiresHrReview,
        hospitalAdmissionDate: input.hospitalAdmissionDate
          ? dateOnlyToUtc(input.hospitalAdmissionDate)
          : null,
        hospitalDischargeDate: input.hospitalDischargeDate
          ? dateOnlyToUtc(input.hospitalDischargeDate)
          : null,
        documentsReceived: input.documentsReceived,
        firstDocumentReceivedAt: input.firstDocumentReceivedAt
          ? new Date(input.firstDocumentReceivedAt)
          : null,
        payrollProcessingMonth: input.payrollProcessingMonth,
        expectedReturnDate: input.expectedReturnDate
          ? dateOnlyToUtc(input.expectedReturnDate)
          : null,
        actualReturnDate: input.actualReturnDate
          ? dateOnlyToUtc(input.actualReturnDate)
          : null,
        returnVisitRequired: input.returnVisitRequired,
        returnVisitStatus: input.returnVisitStatus,
        returnVisitPlannedDate: input.returnVisitPlannedDate
          ? dateOnlyToUtc(input.returnVisitPlannedDate)
          : null,
        returnVisitDeadline: input.returnVisitDeadline
          ? dateOnlyToUtc(input.returnVisitDeadline)
          : null,
        processedByEmployeeId: input.processedByEmployeeId,
        processedAt: input.processedAt ? new Date(input.processedAt) : null,
      },
    });
    return mapWorkAbsence(row);
  },

  async updateWorkAbsence(id, patch) {
    const { mapWorkAbsence, dateOnlyToUtc } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const data: Record<string, unknown> = { ...patch };
    for (const key of [
      "startDate",
      "endDate",
      "hospitalAdmissionDate",
      "hospitalDischargeDate",
      "expectedReturnDate",
      "actualReturnDate",
      "returnVisitPlannedDate",
      "returnVisitDeadline",
    ] as const) {
      if (patch[key] !== undefined) {
        data[key] = patch[key] ? dateOnlyToUtc(patch[key] as string) : null;
      }
    }
    for (const key of ["firstDocumentReceivedAt", "processedAt"] as const) {
      if (patch[key] !== undefined) {
        data[key] = patch[key] ? new Date(patch[key] as string) : null;
      }
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const row = await getPrismaClient().workAbsence.update({
      where: { id },
      data,
    });
    return mapWorkAbsence(row);
  },

  async listWorkAbsenceDocuments(absenceId) {
    const { mapWorkAbsenceDocument } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const rows = await getPrismaClient().workAbsenceDocument.findMany({
      where: { absenceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapWorkAbsenceDocument);
  },

  async createWorkAbsenceDocument(input) {
    const { mapWorkAbsenceDocument } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().workAbsenceDocument.create({
      data: {
        id: newId("wadoc"),
        absenceId: input.absenceId,
        kind: input.kind,
        fileName: input.fileName,
        contentType: input.contentType,
        storageKey: input.storageKey,
        uploadedByEmployeeId: input.uploadedByEmployeeId,
        receivedByHrAt: input.receivedByHrAt
          ? new Date(input.receivedByHrAt)
          : null,
      },
    });
    return mapWorkAbsenceDocument(row);
  },

  async updateWorkAbsenceDocument(id, patch) {
    const { mapWorkAbsenceDocument } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const data: Record<string, unknown> = { ...patch };
    if (patch.receivedByHrAt !== undefined) {
      data.receivedByHrAt = patch.receivedByHrAt
        ? new Date(patch.receivedByHrAt)
        : null;
    }
    delete data.id;
    delete data.createdAt;
    const row = await getPrismaClient().workAbsenceDocument.update({
      where: { id },
      data,
    });
    return mapWorkAbsenceDocument(row);
  },

  async addWorkAbsenceEvent(input) {
    const { mapWorkAbsenceEvent } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const row = await getPrismaClient().workAbsenceEvent.create({
      data: {
        id: newId("waevt"),
        absenceId: input.absenceId,
        kind: input.kind,
        message: input.message,
        actorId: input.actorId,
      },
    });
    return mapWorkAbsenceEvent(row);
  },

  async listWorkAbsenceEvents(absenceId) {
    const { mapWorkAbsenceEvent } = await import(
      "@/infrastructure/persistence/prisma-mappers"
    );
    const rows = await getPrismaClient().workAbsenceEvent.findMany({
      where: { absenceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapWorkAbsenceEvent);
  },
};

function mapWorkOnHoliday(row: {
  id: string;
  employeeId: string;
  holidayDate: Date;
  holidaySourceKey: string;
  holidayName: string;
  plannedHours: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  reason: string;
  status: import("@/domain/types/hr").WorkOnHolidayStatus;
  decidedByEmployeeId: string | null;
  decisionComment: string | null;
  decidedAt: Date | null;
  actualHours: number | null;
  actualDeclaredAt: Date | null;
  confirmedHours: number | null;
  confirmedByEmployeeId: string | null;
  confirmedAt: Date | null;
  creditLedgerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): import("@/domain/types/hr").WorkOnHolidayRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    holidayDate: row.holidayDate.toISOString().slice(0, 10),
    holidaySourceKey: row.holidaySourceKey,
    holidayName: row.holidayName,
    plannedHours: row.plannedHours,
    plannedStart: row.plannedStart,
    plannedEnd: row.plannedEnd,
    reason: row.reason,
    status: row.status,
    decidedByEmployeeId: row.decidedByEmployeeId,
    decisionComment: row.decisionComment,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    actualHours: row.actualHours,
    actualDeclaredAt: row.actualDeclaredAt?.toISOString() ?? null,
    confirmedHours: row.confirmedHours,
    confirmedByEmployeeId: row.confirmedByEmployeeId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    creditLedgerId: row.creditLedgerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRecoveryCredit(row: {
  id: string;
  employeeId: string;
  year: number;
  sourceKind: string;
  sourceRequestId: string;
  hoursConfirmed: number;
  daysCredited: number;
  dailyHoursUsed: number;
  actorEmployeeId: string;
  createdAt: Date;
}): import("@/domain/types/hr").RecoveryCreditLedgerEntry {
  return {
    id: row.id,
    employeeId: row.employeeId,
    year: row.year,
    sourceKind: "work_on_holiday",
    sourceRequestId: row.sourceRequestId,
    hoursConfirmed: row.hoursConfirmed,
    daysCredited: row.daysCredited,
    dailyHoursUsed: row.dailyHoursUsed,
    actorEmployeeId: row.actorEmployeeId,
    createdAt: row.createdAt.toISOString(),
  };
}
