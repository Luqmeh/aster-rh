import type {
  DemoRole,
  DocumentRequest,
  DocumentRequestEvent,
  DocumentRequestStatus,
  DocumentRequestType,
  Employee,
  EmploymentStatus,
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

export type EmployeeCreateInput = Omit<
  Employee,
  "demoIdentityId" | "avatarInitials" | "isActive" | "teleworkDaysPerWeek"
> & {
  demoIdentityId?: string | null;
  avatarInitials?: string;
  teleworkDaysPerWeek?: number;
  teleworkEligible?: boolean;
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
        | "managerId"
        | "site"
        | "contractType"
        | "category"
        | "hireDate"
        | "employmentStatus"
        | "departureDate"
        | "departureNote"
        | "isActive"
        | "phoneInternal"
        | "teleworkEligible"
        | "teleworkDaysPerWeek"
        | "avatarInitials"
      >
    >,
  ): Promise<Employee>;
  listTeamMembers(managerId: string): Promise<Employee[]>;
  getLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance | null>;
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
}
