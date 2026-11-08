import { getDemoStore } from "@/infrastructure/persistence/demo-store";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import type { LeaveRequest, TeleworkRequest } from "@/domain/types/hr";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const demoHrRepository: HrRepository = {
  async listDepartments() {
    return getDemoStore().departments;
  },

  async listEmployees(filter) {
    const rows = getDemoStore().employees;
    if (filter?.includeInactive) return [...rows];
    return rows.filter((e) => e.isActive);
  },

  async getEmployee(id) {
    return getDemoStore().employees.find((e) => e.id === id) ?? null;
  },

  async updateEmployee(id, patch) {
    const store = getDemoStore();
    const index = store.employees.findIndex((e) => e.id === id);
    if (index < 0) throw new Error("Collaborateur introuvable.");
    const updated = { ...store.employees[index], ...patch };
    store.employees[index] = updated;
    return updated;
  },

  async listTeamMembers(managerId) {
    return getDemoStore().employees.filter(
      (e) => e.managerId === managerId && e.isActive,
    );
  },

  async getLeaveBalance(employeeId, year) {
    return (
      getDemoStore().leaveBalances.find(
        (b) => b.employeeId === employeeId && b.year === year,
      ) ?? null
    );
  },

  async listLeaveRequests(filter) {
    const store = getDemoStore();
    let items = [...store.leaveRequests];
    if (filter?.employeeId) {
      items = items.filter((r) => r.employeeId === filter.employeeId);
    }
    if (filter?.status) {
      items = items.filter((r) => r.status === filter.status);
    }
    if (filter?.managerId) {
      const teamIds = new Set(
        store.employees
          .filter((e) => e.managerId === filter.managerId)
          .map((e) => e.id),
      );
      items = items.filter((r) => teamIds.has(r.employeeId));
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getLeaveRequest(id) {
    return getDemoStore().leaveRequests.find((r) => r.id === id) ?? null;
  },

  async createLeaveRequest(input) {
    const now = new Date().toISOString();
    const request: LeaveRequest = {
      ...input,
      id: uid("leave"),
      createdAt: now,
      updatedAt: now,
    };
    getDemoStore().leaveRequests.unshift(request);
    return request;
  },

  async updateLeaveRequest(id, patch) {
    const store = getDemoStore();
    const index = store.leaveRequests.findIndex((r) => r.id === id);
    if (index < 0) throw new Error("Demande de congés introuvable.");
    const updated = {
      ...store.leaveRequests[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store.leaveRequests[index] = updated;
    return updated;
  },

  async listTeleworkRequests(filter) {
    const store = getDemoStore();
    let items = [...store.teleworkRequests];
    if (filter?.employeeId) {
      items = items.filter((r) => r.employeeId === filter.employeeId);
    }
    if (filter?.managerId) {
      const teamIds = new Set(
        store.employees
          .filter((e) => e.managerId === filter.managerId)
          .map((e) => e.id),
      );
      items = items.filter((r) => teamIds.has(r.employeeId));
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getTeleworkRequest(id) {
    return getDemoStore().teleworkRequests.find((r) => r.id === id) ?? null;
  },

  async createTeleworkRequest(input) {
    const now = new Date().toISOString();
    const request: TeleworkRequest = {
      ...input,
      id: uid("tw"),
      createdAt: now,
      updatedAt: now,
    };
    getDemoStore().teleworkRequests.unshift(request);
    return request;
  },

  async updateTeleworkRequest(id, patch) {
    const store = getDemoStore();
    const index = store.teleworkRequests.findIndex((r) => r.id === id);
    if (index < 0) throw new Error("Demande de télétravail introuvable.");
    const updated = {
      ...store.teleworkRequests[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store.teleworkRequests[index] = updated;
    return updated;
  },

  async listNotifications(recipientId) {
    return getDemoStore()
      .notifications.filter((n) => n.recipientId === recipientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addNotification(input) {
    const item = { ...input, id: uid("notif") };
    getDemoStore().notifications.unshift(item);
    return item;
  },

  async listDocuments(employeeId) {
    return getDemoStore().documents.filter(
      (d) => d.isCompanyWide || (employeeId && d.employeeId === employeeId),
    );
  },
};
