import {
  departments,
  documents,
  employees,
  leaveBalances,
  leaveRequests,
  notifications,
  teleworkRequests,
} from "@/data/demo-seed";
import type {
  Employee,
  HrDocument,
  LeaveBalance,
  LeaveRequest,
  NotificationItem,
  OrganizationUnit,
  RecruitmentCandidate,
  RecruitmentEvent,
  RoleChangeAuditEntry,
  TeleworkRequest,
} from "@/domain/types/hr";
import type { StoredUserAccount } from "@/infrastructure/auth/account-store";

export interface DemoStore {
  departments: OrganizationUnit[];
  employees: Employee[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  teleworkRequests: TeleworkRequest[];
  notifications: NotificationItem[];
  documents: HrDocument[];
  recruitmentCandidates: RecruitmentCandidate[];
  recruitmentEvents: RecruitmentEvent[];
  roleChangeAudits: RoleChangeAuditEntry[];
  accounts: StoredUserAccount[];
}

declare global {
  var __asterDemoStore: DemoStore | undefined;
}

function cloneStore(): DemoStore {
  return {
    departments: structuredClone(departments),
    employees: structuredClone(employees),
    leaveBalances: structuredClone(leaveBalances),
    leaveRequests: structuredClone(leaveRequests),
    teleworkRequests: structuredClone(teleworkRequests),
    notifications: structuredClone(notifications),
    documents: structuredClone(documents),
    recruitmentCandidates: [],
    recruitmentEvents: [],
    roleChangeAudits: [],
    accounts: [],
  };
}

/** Store de démonstration en mémoire — réinitialisable, non durable. */
export function getDemoStore(): DemoStore {
  if (!globalThis.__asterDemoStore) {
    globalThis.__asterDemoStore = cloneStore();
  }
  return globalThis.__asterDemoStore;
}

export function resetDemoStore(): DemoStore {
  globalThis.__asterDemoStore = cloneStore();
  return globalThis.__asterDemoStore;
}
