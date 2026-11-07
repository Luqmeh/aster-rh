import type { LeaveRequest } from "@/domain/types/hr";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import { getPrismaClient } from "@/infrastructure/persistence/prisma-client";
import {
  dateOnlyToUtc,
  mapDocument,
  mapEmployee,
  mapLeaveBalance,
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

  async listEmployees() {
    const rows = await getPrismaClient().employee.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map(mapEmployee);
  },

  async getEmployee(id) {
    const row = await getPrismaClient().employee.findUnique({ where: { id } });
    return row ? mapEmployee(row) : null;
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
};
