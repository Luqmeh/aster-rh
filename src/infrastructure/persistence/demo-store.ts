import {
  departments,
  documents,
  employees,
  leaveBalances,
  leaveRequests,
  notifications,
  peopleManagers,
  teleworkRequests,
} from "@/data/demo-seed";
import type {
  DocumentRequest,
  DocumentRequestEvent,
  Employee,
  HolidayOverride,
  HrDocument,
  LeaveBalance,
  LeaveRequest,
  NotificationItem,
  OrganizationUnit,
  PeopleManagerEntry,
  RecoveryCreditLedgerEntry,
  RecruitmentCandidate,
  RecruitmentEvent,
  RoleChangeAuditEntry,
  TeleworkRequest,
  WorkAbsence,
  WorkAbsenceDocument,
  WorkAbsenceEvent,
  WorkOnHolidayRequest,
} from "@/domain/types/hr";
import type { HrImportBatch } from "@/domain/types/hr-import";
import type { LeaveLedgerEntry } from "@/domain/types/leave-ledger";
import type { StoredUserAccount } from "@/infrastructure/auth/account-store";

export interface DemoStore {
  departments: OrganizationUnit[];
  employees: Employee[];
  peopleManagers: PeopleManagerEntry[];
  leaveBalances: LeaveBalance[];
  leaveLedgerEntries: LeaveLedgerEntry[];
  leaveRequests: LeaveRequest[];
  teleworkRequests: TeleworkRequest[];
  notifications: NotificationItem[];
  documents: HrDocument[];
  recruitmentCandidates: RecruitmentCandidate[];
  recruitmentEvents: RecruitmentEvent[];
  documentRequests: DocumentRequest[];
  documentRequestEvents: DocumentRequestEvent[];
  holidayOverrides: HolidayOverride[];
  workOnHolidayRequests: WorkOnHolidayRequest[];
  recoveryCredits: RecoveryCreditLedgerEntry[];
  workAbsences: WorkAbsence[];
  workAbsenceDocuments: WorkAbsenceDocument[];
  workAbsenceEvents: WorkAbsenceEvent[];
  roleChangeAudits: RoleChangeAuditEntry[];
  accounts: StoredUserAccount[];
  hrImportBatches: HrImportBatch[];
}

declare global {
  var __asterDemoStore: DemoStore | undefined;
}

function cloneStore(): DemoStore {
  return {
    departments: structuredClone(departments),
    employees: structuredClone(employees),
    peopleManagers: structuredClone(peopleManagers),
    leaveBalances: structuredClone(leaveBalances),
    leaveLedgerEntries: [],
    leaveRequests: structuredClone(leaveRequests),
    teleworkRequests: structuredClone(teleworkRequests),
    notifications: structuredClone(notifications),
    documents: structuredClone(documents),
    recruitmentCandidates: [],
    recruitmentEvents: [],
    documentRequests: [],
    documentRequestEvents: [],
    holidayOverrides: [],
    workOnHolidayRequests: [],
    recoveryCredits: [],
    workAbsences: [],
    workAbsenceDocuments: [],
    workAbsenceEvents: [],
    roleChangeAudits: [],
    accounts: [],
    hrImportBatches: [],
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
