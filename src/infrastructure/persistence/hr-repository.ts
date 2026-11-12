import type {
  DemoRole,
  DocumentRequest,
  DocumentRequestEvent,
  DocumentRequestStatus,
  DocumentRequestType,
  Employee,
  EmploymentStatus,
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
  WorkAbsenceStatus,
  WorkOnHolidayRequest,
  WorkOnHolidayStatus,
} from "@/domain/types/hr";
import type {
  LeaveLedgerEntry,
  LeaveLedgerEntryCreateInput,
} from "@/domain/types/leave-ledger";

export type EmployeeCreateInput = Omit<
  Employee,
  | "demoIdentityId"
  | "avatarInitials"
  | "isActive"
  | "teleworkDaysPerWeek"
  | "standardDailyHours"
  | "isPartTime"
  | "weeklyContractHours"
  | "workingTimePercent"
  | "officeCalendarId"
  | "policyGroup"
  | "birthDate"
  | "activitySector"
  | "managerId"
> & {
  demoIdentityId?: string | null;
  avatarInitials?: string;
  teleworkDaysPerWeek?: number;
  standardDailyHours?: number;
  teleworkEligible?: boolean;
  isPartTime?: boolean;
  weeklyContractHours?: number | null;
  workingTimePercent?: number | null;
  officeCalendarId?: string | null;
  policyGroup?: string | null;
  birthDate?: string | null;
  activitySector?: "non_agricole" | "agricole";
  /** Legacy — synchronisé depuis People Manager lié si fourni. */
  managerId?: string | null;
};

export type PeopleManagerCreateInput = {
  id?: string;
  displayName: string;
  linkedEmployeeId?: string | null;
  isActive?: boolean;
};

/**
 * Port de persistence RH — remplaçable par un adaptateur Prisma/Supabase.
 */
export interface HrRepository {
  listDepartments(): Promise<OrganizationUnit[]>;
  listEmployees(options?: {
    includeInactive?: boolean;
    employmentStatus?: EmploymentStatus | EmploymentStatus[];
  }): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | null>;
  getEmployeeByEmail(email: string): Promise<Employee | null>;
  createEmployee(input: EmployeeCreateInput): Promise<Employee>;
  updateEmployee(
    id: string,
    patch: Partial<
      Pick<
        Employee,
        | "firstName"
        | "lastName"
        | "email"
        | "jobTitle"
        | "departmentId"
        | "peopleManagerId"
        | "managerId"
        | "region"
        | "contractType"
        | "grade"
        | "hireDate"
        | "employmentStatus"
        | "departureDate"
        | "departureNote"
        | "isActive"
        | "phoneInternal"
        | "teleworkEligible"
        | "teleworkDaysPerWeek"
        | "standardDailyHours"
        | "isPartTime"
        | "weeklyContractHours"
        | "workingTimePercent"
        | "officeCalendarId"
        | "policyGroup"
        | "birthDate"
        | "activitySector"
        | "avatarInitials"
      >
    >,
  ): Promise<Employee>;
  listPeopleManagers(options?: {
    includeInactive?: boolean;
  }): Promise<PeopleManagerEntry[]>;
  getPeopleManager(id: string): Promise<PeopleManagerEntry | null>;
  createPeopleManager(
    input: PeopleManagerCreateInput,
  ): Promise<PeopleManagerEntry>;
  updatePeopleManager(
    id: string,
    patch: Partial<
      Pick<PeopleManagerEntry, "displayName" | "linkedEmployeeId" | "isActive">
    >,
  ): Promise<PeopleManagerEntry>;
  updateLeaveBalance(
    employeeId: string,
    year: number,
    patch: Partial<LeaveBalance>,
  ): Promise<LeaveBalance>;
  /**
   * Équipe d'un acteur : collaborateurs dont le People Manager est lié à `managerId`
   * OU (legacy) dont `managerId` correspond.
   */
  listTeamMembers(managerId: string): Promise<Employee[]>;
  getLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance | null>;
  listLeaveBalances(year?: number): Promise<LeaveBalance[]>;

  listLeaveLedgerEntries(filter?: {
    employeeId?: string;
    account?: LeaveLedgerEntry["account"];
    year?: number;
  }): Promise<LeaveLedgerEntry[]>;
  getLeaveLedgerEntryBySource(input: {
    sourceKind: string;
    sourceId: string;
    transactionType: LeaveLedgerEntry["transactionType"];
  }): Promise<LeaveLedgerEntry | null>;
  /**
   * Append-only. Idempotent si (sourceKind, sourceId, transactionType) existe déjà
   * — retourne l'écriture existante sans la modifier.
   */
  appendLeaveLedgerEntry(
    input: LeaveLedgerEntryCreateInput,
  ): Promise<{ entry: LeaveLedgerEntry; created: boolean }>;

  listLeaveRequests(filter?: {
    employeeId?: string;
    managerId?: string;
    status?: LeaveRequest["status"];
  }): Promise<LeaveRequest[]>;
  getLeaveRequest(id: string): Promise<LeaveRequest | null>;
  createLeaveRequest(
    input: Omit<LeaveRequest, "id" | "createdAt" | "updatedAt">,
  ): Promise<LeaveRequest>;
  updateLeaveRequest(
    id: string,
    patch: Partial<LeaveRequest>,
  ): Promise<LeaveRequest>;
  listTeleworkRequests(filter?: {
    employeeId?: string;
    managerId?: string;
  }): Promise<TeleworkRequest[]>;
  getTeleworkRequest(id: string): Promise<TeleworkRequest | null>;
  createTeleworkRequest(
    input: Omit<TeleworkRequest, "id" | "createdAt" | "updatedAt">,
  ): Promise<TeleworkRequest>;
  updateTeleworkRequest(
    id: string,
    patch: Partial<TeleworkRequest>,
  ): Promise<TeleworkRequest>;
  listNotifications(recipientId: string): Promise<NotificationItem[]>;
  addNotification(
    input: Omit<NotificationItem, "id">,
  ): Promise<NotificationItem>;
  markNotificationsRead(
    recipientId: string,
    ids?: string[],
  ): Promise<number>;
  listDocuments(employeeId?: string): Promise<HrDocument[]>;

  countAccountsByRole(role: DemoRole): Promise<number>;
  addRoleChangeAudit(
    input: Omit<RoleChangeAuditEntry, "id" | "createdAt">,
  ): Promise<RoleChangeAuditEntry>;
  listRoleChangeAudits(targetAccountId?: string): Promise<RoleChangeAuditEntry[]>;

  listRecruitmentCandidates(filter?: {
    status?: RecruitmentCandidate["status"] | RecruitmentCandidate["status"][];
    createdByEmployeeId?: string;
    interviewerEmployeeId?: string;
    q?: string;
  }): Promise<RecruitmentCandidate[]>;
  getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | null>;
  createRecruitmentCandidate(
    input: Omit<RecruitmentCandidate, "id" | "createdAt" | "updatedAt">,
  ): Promise<RecruitmentCandidate>;
  updateRecruitmentCandidate(
    id: string,
    patch: Partial<RecruitmentCandidate>,
  ): Promise<RecruitmentCandidate>;
  addRecruitmentEvent(
    input: Omit<RecruitmentEvent, "id" | "createdAt">,
  ): Promise<RecruitmentEvent>;
  listRecruitmentEvents(candidateId: string): Promise<RecruitmentEvent[]>;

  listDocumentRequests(filter?: {
    employeeId?: string;
    status?: DocumentRequestStatus | DocumentRequestStatus[];
    documentType?: DocumentRequestType;
    q?: string;
  }): Promise<DocumentRequest[]>;
  getDocumentRequest(id: string): Promise<DocumentRequest | null>;
  createDocumentRequest(
    input: Omit<DocumentRequest, "id" | "createdAt" | "updatedAt">,
  ): Promise<DocumentRequest>;
  updateDocumentRequest(
    id: string,
    patch: Partial<DocumentRequest>,
  ): Promise<DocumentRequest>;
  addDocumentRequestEvent(
    input: Omit<DocumentRequestEvent, "id" | "createdAt">,
  ): Promise<DocumentRequestEvent>;
  listDocumentRequestEvents(
    requestId: string,
  ): Promise<DocumentRequestEvent[]>;

  listHolidayOverrides(year?: number): Promise<HolidayOverride[]>;
  upsertHolidayOverride(
    input: Omit<HolidayOverride, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
    },
  ): Promise<HolidayOverride>;

  listWorkOnHolidayRequests(filter?: {
    employeeId?: string;
    status?: WorkOnHolidayStatus | WorkOnHolidayStatus[];
    holidayDate?: string;
  }): Promise<WorkOnHolidayRequest[]>;
  getWorkOnHolidayRequest(id: string): Promise<WorkOnHolidayRequest | null>;
  createWorkOnHolidayRequest(
    input: Omit<WorkOnHolidayRequest, "id" | "createdAt" | "updatedAt">,
  ): Promise<WorkOnHolidayRequest>;
  updateWorkOnHolidayRequest(
    id: string,
    patch: Partial<WorkOnHolidayRequest>,
  ): Promise<WorkOnHolidayRequest>;

  listRecoveryCredits(employeeId: string): Promise<RecoveryCreditLedgerEntry[]>;
  getRecoveryCreditBySourceRequest(
    sourceRequestId: string,
  ): Promise<RecoveryCreditLedgerEntry | null>;
  createRecoveryCredit(
    input: Omit<RecoveryCreditLedgerEntry, "id" | "createdAt">,
  ): Promise<RecoveryCreditLedgerEntry>;

  listWorkAbsences(filter?: {
    employeeId?: string;
    status?: WorkAbsenceStatus | WorkAbsenceStatus[];
    family?: WorkAbsence["family"];
    category?: WorkAbsence["category"];
  }): Promise<WorkAbsence[]>;
  getWorkAbsence(id: string): Promise<WorkAbsence | null>;
  createWorkAbsence(
    input: Omit<WorkAbsence, "id" | "createdAt" | "updatedAt">,
  ): Promise<WorkAbsence>;
  updateWorkAbsence(
    id: string,
    patch: Partial<WorkAbsence>,
  ): Promise<WorkAbsence>;
  listWorkAbsenceDocuments(absenceId: string): Promise<WorkAbsenceDocument[]>;
  createWorkAbsenceDocument(
    input: Omit<WorkAbsenceDocument, "id" | "createdAt">,
  ): Promise<WorkAbsenceDocument>;
  updateWorkAbsenceDocument(
    id: string,
    patch: Partial<WorkAbsenceDocument>,
  ): Promise<WorkAbsenceDocument>;
  addWorkAbsenceEvent(
    input: Omit<WorkAbsenceEvent, "id" | "createdAt">,
  ): Promise<WorkAbsenceEvent>;
  listWorkAbsenceEvents(absenceId: string): Promise<WorkAbsenceEvent[]>;
}
