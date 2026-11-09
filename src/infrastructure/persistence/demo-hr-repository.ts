import { syncIsActive } from "@/domain/rules/lifecycle";
import { getDemoStore } from "@/infrastructure/persistence/demo-store";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import type {
  Employee,
  LeaveRequest,
  RecruitmentCandidate,
  TeleworkRequest,
} from "@/domain/types/hr";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const demoHrRepository: HrRepository = {
  async listDepartments() {
    return getDemoStore().departments;
  },

  async listEmployees(filter) {
    let rows = [...getDemoStore().employees];
    if (filter?.employmentStatus) {
      const statuses = Array.isArray(filter.employmentStatus)
        ? filter.employmentStatus
        : [filter.employmentStatus];
      rows = rows.filter((e) => statuses.includes(e.employmentStatus));
    } else if (!filter?.includeInactive) {
      rows = rows.filter((e) => e.isActive);
    }
    return rows;
  },

  async getEmployee(id) {
    return getDemoStore().employees.find((e) => e.id === id) ?? null;
  },

  async getEmployeeByEmail(email) {
    const normalized = email.trim().toLowerCase();
    return (
      getDemoStore().employees.find(
        (e) => e.email.toLowerCase() === normalized,
      ) ?? null
    );
  },

  async createEmployee(input) {
    const store = getDemoStore();
    if (store.employees.some((e) => e.id === input.id)) {
      throw new Error("Identifiant collaborateur déjà utilisé.");
    }
    if (
      store.employees.some(
        (e) => e.email.toLowerCase() === input.email.toLowerCase(),
      )
    ) {
      throw new Error("Adresse e-mail déjà utilisée.");
    }
    const employmentStatus = input.employmentStatus ?? "actif";
    const employee: Employee = {
      id: input.id,
      demoIdentityId: input.demoIdentityId ?? `provisioned-${input.id}`,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      jobTitle: input.jobTitle,
      departmentId: input.departmentId,
      managerId: input.managerId,
      site: input.site,
      contractType: input.contractType,
      category: input.category,
      hireDate: input.hireDate,
      employmentStatus,
      departureDate: input.departureDate ?? null,
      departureNote: input.departureNote ?? null,
      isActive: syncIsActive(employmentStatus),
      phoneInternal: input.phoneInternal ?? null,
      avatarInitials:
        input.avatarInitials ??
        `${input.firstName.charAt(0)}${input.lastName.charAt(0)}`.toUpperCase(),
      teleworkEligible: input.teleworkEligible ?? true,
      teleworkDaysPerWeek: input.teleworkDaysPerWeek ?? 2,
      standardDailyHours: input.standardDailyHours ?? 7,
    };
    store.employees.push(employee);
    return employee;
  },

  async updateEmployee(id, patch) {
    const store = getDemoStore();
    const index = store.employees.findIndex((e) => e.id === id);
    if (index < 0) throw new Error("Collaborateur introuvable.");
    const next = { ...store.employees[index], ...patch };
    if (patch.employmentStatus) {
      next.isActive = syncIsActive(patch.employmentStatus);
    }
    store.employees[index] = next;
    return next;
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

  async countAccountsByRole(role) {
    return getDemoStore().accounts.filter(
      (a) => a.role === role && a.isActive,
    ).length;
  },

  async addRoleChangeAudit(input) {
    const entry = {
      ...input,
      id: uid("role-audit"),
      createdAt: new Date().toISOString(),
    };
    getDemoStore().roleChangeAudits.unshift(entry);
    return entry;
  },

  async listRoleChangeAudits(targetAccountId) {
    const rows = getDemoStore().roleChangeAudits;
    return targetAccountId
      ? rows.filter((r) => r.targetAccountId === targetAccountId)
      : [...rows];
  },

  async listRecruitmentCandidates(filter) {
    let items = [...getDemoStore().recruitmentCandidates];
    if (filter?.createdByEmployeeId) {
      items = items.filter(
        (c) => c.createdByEmployeeId === filter.createdByEmployeeId,
      );
    }
    if (filter?.interviewerEmployeeId) {
      items = items.filter(
        (c) => c.interviewerEmployeeId === filter.interviewerEmployeeId,
      );
    }
    if (filter?.status) {
      const statuses = Array.isArray(filter.status)
        ? filter.status
        : [filter.status];
      items = items.filter((c) => statuses.includes(c.status));
    }
    if (filter?.q?.trim()) {
      const q = filter.q.trim().toLowerCase();
      items = items.filter((c) =>
        `${c.fullName} ${c.email} ${c.positionTitle}`.toLowerCase().includes(q),
      );
    }
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getRecruitmentCandidate(id) {
    return (
      getDemoStore().recruitmentCandidates.find((c) => c.id === id) ?? null
    );
  },

  async createRecruitmentCandidate(input) {
    const now = new Date().toISOString();
    const candidate: RecruitmentCandidate = {
      ...input,
      id: uid("rec"),
      createdAt: now,
      updatedAt: now,
    };
    getDemoStore().recruitmentCandidates.unshift(candidate);
    return candidate;
  },

  async updateRecruitmentCandidate(id, patch) {
    const store = getDemoStore();
    const index = store.recruitmentCandidates.findIndex((c) => c.id === id);
    if (index < 0) throw new Error("Dossier candidat introuvable.");
    const updated = {
      ...store.recruitmentCandidates[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store.recruitmentCandidates[index] = updated;
    return updated;
  },

  async addRecruitmentEvent(input) {
    const event = {
      ...input,
      id: uid("recevt"),
      createdAt: new Date().toISOString(),
    };
    getDemoStore().recruitmentEvents.unshift(event);
    return event;
  },

  async listRecruitmentEvents(candidateId) {
    return getDemoStore()
      .recruitmentEvents.filter((e) => e.candidateId === candidateId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listDocumentRequests(filter) {
    let items = [...getDemoStore().documentRequests];
    if (filter?.employeeId) {
      items = items.filter((r) => r.employeeId === filter.employeeId);
    }
    if (filter?.status) {
      const statuses = Array.isArray(filter.status)
        ? filter.status
        : [filter.status];
      items = items.filter((r) => statuses.includes(r.status));
    }
    if (filter?.documentType) {
      items = items.filter((r) => r.documentType === filter.documentType);
    }
    if (filter?.q?.trim()) {
      const q = filter.q.trim().toLowerCase();
      const emps = getDemoStore().employees;
      items = items.filter((r) => {
        const emp = emps.find((e) => e.id === r.employeeId);
        const name = emp
          ? `${emp.firstName} ${emp.lastName}`.toLowerCase()
          : "";
        return (
          name.includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          (r.customLabel ?? "").toLowerCase().includes(q)
        );
      });
    }
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getDocumentRequest(id) {
    return getDemoStore().documentRequests.find((r) => r.id === id) ?? null;
  },

  async createDocumentRequest(input) {
    const now = new Date().toISOString();
    const row = {
      ...input,
      id: uid("docreq"),
      createdAt: now,
      updatedAt: now,
    };
    getDemoStore().documentRequests.unshift(row);
    return row;
  },

  async updateDocumentRequest(id, patch) {
    const store = getDemoStore();
    const index = store.documentRequests.findIndex((r) => r.id === id);
    if (index < 0) throw new Error("Demande documentaire introuvable.");
    const updated = {
      ...store.documentRequests[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store.documentRequests[index] = updated;
    return updated;
  },

  async addDocumentRequestEvent(input) {
    const event = {
      ...input,
      id: uid("docreqevt"),
      createdAt: new Date().toISOString(),
    };
    getDemoStore().documentRequestEvents.unshift(event);
    return event;
  },

  async listDocumentRequestEvents(requestId) {
    return getDemoStore()
      .documentRequestEvents.filter((e) => e.requestId === requestId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async updateLeaveBalance(employeeId, year, patch) {
    const store = getDemoStore();
    const index = store.leaveBalances.findIndex(
      (b) => b.employeeId === employeeId && b.year === year,
    );
    if (index < 0) {
      const created = {
        employeeId,
        year,
        congesPayesAcquis: 0,
        congesPayesPris: 0,
        congesPayesRestants: 0,
        rttAcquis: 0,
        rttPris: 0,
        rttRestants: 0,
        recoveryDaysAcquis: 0,
        recoveryDaysPris: 0,
        recoveryDaysRestants: 0,
        ...patch,
      };
      store.leaveBalances.push(created);
      return created;
    }
    const updated = { ...store.leaveBalances[index], ...patch };
    store.leaveBalances[index] = updated;
    return updated;
  },

  async listHolidayOverrides(year) {
    const rows = getDemoStore().holidayOverrides;
    return year ? rows.filter((r) => r.year === year) : [...rows];
  },

  async upsertHolidayOverride(input) {
    const store = getDemoStore();
    const existing = store.holidayOverrides.findIndex(
      (h) =>
        h.sourceKey === input.sourceKey &&
        h.year === input.year,
    );
    const now = new Date().toISOString();
    if (existing >= 0) {
      const updated = {
        ...store.holidayOverrides[existing],
        ...input,
        id: store.holidayOverrides[existing].id,
        updatedAt: now,
      };
      store.holidayOverrides[existing] = updated;
      return updated;
    }
    const created = {
      ...input,
      id: input.id ?? uid("hol"),
      createdAt: now,
      updatedAt: now,
    };
    store.holidayOverrides.unshift(created);
    return created;
  },

  async listWorkOnHolidayRequests(filter) {
    let items = [...getDemoStore().workOnHolidayRequests];
    if (filter?.employeeId) {
      items = items.filter((r) => r.employeeId === filter.employeeId);
    }
    if (filter?.holidayDate) {
      items = items.filter((r) => r.holidayDate === filter.holidayDate);
    }
    if (filter?.status) {
      const statuses = Array.isArray(filter.status)
        ? filter.status
        : [filter.status];
      items = items.filter((r) => statuses.includes(r.status));
    }
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getWorkOnHolidayRequest(id) {
    return (
      getDemoStore().workOnHolidayRequests.find((r) => r.id === id) ?? null
    );
  },

  async createWorkOnHolidayRequest(input) {
    const now = new Date().toISOString();
    const row = {
      ...input,
      id: uid("woh"),
      createdAt: now,
      updatedAt: now,
    };
    getDemoStore().workOnHolidayRequests.unshift(row);
    return row;
  },

  async updateWorkOnHolidayRequest(id, patch) {
    const store = getDemoStore();
    const index = store.workOnHolidayRequests.findIndex((r) => r.id === id);
    if (index < 0) throw new Error("Demande travail férié introuvable.");
    const updated = {
      ...store.workOnHolidayRequests[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store.workOnHolidayRequests[index] = updated;
    return updated;
  },

  async listRecoveryCredits(employeeId) {
    return getDemoStore()
      .recoveryCredits.filter((c) => c.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getRecoveryCreditBySourceRequest(sourceRequestId) {
    return (
      getDemoStore().recoveryCredits.find(
        (c) => c.sourceRequestId === sourceRequestId,
      ) ?? null
    );
  },

  async createRecoveryCredit(input) {
    const existing = getDemoStore().recoveryCredits.find(
      (c) => c.sourceRequestId === input.sourceRequestId,
    );
    if (existing) {
      throw new Error("Crédit déjà enregistré pour cette demande.");
    }
    const row = {
      ...input,
      id: uid("rcred"),
      createdAt: new Date().toISOString(),
    };
    getDemoStore().recoveryCredits.unshift(row);
    return row;
  },
};
