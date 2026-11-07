import type {
  Employee,
  HrDocument,
  LeaveBalance,
  LeaveRequest,
  NotificationItem,
  OrganizationUnit,
  TeleworkRequest,
} from "@/domain/types/hr";

/**
 * Port de persistence RH — remplaçable par un adaptateur Prisma/Supabase.
 */
export interface HrRepository {
  listDepartments(): Promise<OrganizationUnit[]>;
  listEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | null>;
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
}
