import type {
  ContractType,
  Employee,
  EmployeeCategory,
  HrDocument,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  NotificationItem,
  OrganizationUnit,
  RequestStatus,
  TeleworkRequest,
  TeleworkType,
} from "@/domain/types/hr";

/** Date métier (yyyy-mm-dd) → Date UTC midnight pour Prisma. */
export function dateOnlyToUtc(dateOnly: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new Error(`Date invalide (attendu yyyy-mm-dd) : ${dateOnly}`);
  }
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/** DateTime Prisma → date métier yyyy-mm-dd (UTC). */
export function utcToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function utcToIso(value: Date): string {
  return value.toISOString();
}

type PrismaOrganizationUnit = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
};

type PrismaEmployee = {
  id: string;
  demoIdentityId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  departmentId: string;
  managerId: string | null;
  site: string;
  contractType: ContractType;
  category: EmployeeCategory;
  hireDate: Date;
  isActive: boolean;
  phoneInternal: string | null;
  avatarInitials: string;
  teleworkEligible: boolean;
  teleworkDaysPerWeek: number;
};

type PrismaLeaveBalance = {
  employeeId: string;
  year: number;
  congesPayesAcquis: number;
  congesPayesPris: number;
  congesPayesRestants: number;
  rttAcquis: number;
  rttPris: number;
  rttRestants: number;
};

type PrismaLeaveRequest = {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  daysCount: number;
  status: RequestStatus;
  comment: string | null;
  managerComment: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaTeleworkRequest = {
  id: string;
  employeeId: string;
  type: TeleworkType;
  month: string | null;
  startDate: Date;
  endDate: Date;
  days: string[];
  status: RequestStatus;
  reason: string | null;
  managerComment: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaNotification = {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: Date;
};

type PrismaDocument = {
  id: string;
  employeeId: string | null;
  title: string;
  category: string;
  uploadedAt: Date;
  storageKey: string;
  isCompanyWide: boolean;
};

export function mapOrganizationUnit(
  row: PrismaOrganizationUnit,
): OrganizationUnit {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    parentId: row.parentId,
  };
}

export function mapEmployee(row: PrismaEmployee): Employee {
  return {
    id: row.id,
    demoIdentityId: row.demoIdentityId ?? "demo-none",
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    jobTitle: row.jobTitle,
    departmentId: row.departmentId,
    managerId: row.managerId,
    site: row.site,
    contractType: row.contractType,
    category: row.category,
    hireDate: utcToDateOnly(row.hireDate),
    isActive: row.isActive,
    phoneInternal: row.phoneInternal,
    avatarInitials: row.avatarInitials,
    teleworkEligible: row.teleworkEligible,
    teleworkDaysPerWeek: row.teleworkDaysPerWeek,
  };
}

export function mapLeaveBalance(row: PrismaLeaveBalance): LeaveBalance {
  return {
    employeeId: row.employeeId,
    year: row.year,
    congesPayesAcquis: row.congesPayesAcquis,
    congesPayesPris: row.congesPayesPris,
    congesPayesRestants: row.congesPayesRestants,
    rttAcquis: row.rttAcquis,
    rttPris: row.rttPris,
    rttRestants: row.rttRestants,
  };
}

export function mapLeaveRequest(row: PrismaLeaveRequest): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    startDate: utcToDateOnly(row.startDate),
    endDate: utcToDateOnly(row.endDate),
    halfDayStart: row.halfDayStart,
    halfDayEnd: row.halfDayEnd,
    daysCount: row.daysCount,
    status: row.status,
    comment: row.comment,
    managerComment: row.managerComment,
    createdAt: utcToIso(row.createdAt),
    updatedAt: utcToIso(row.updatedAt),
  };
}

export function mapTeleworkRequest(
  row: PrismaTeleworkRequest,
): TeleworkRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    month: row.month,
    startDate: utcToDateOnly(row.startDate),
    endDate: utcToDateOnly(row.endDate),
    days: [...row.days],
    status: row.status,
    reason: row.reason,
    managerComment: row.managerComment,
    createdAt: utcToIso(row.createdAt),
    updatedAt: utcToIso(row.updatedAt),
  };
}

export function mapNotification(row: PrismaNotification): NotificationItem {
  return {
    id: row.id,
    recipientId: row.recipientId,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.read,
    createdAt: utcToIso(row.createdAt),
  };
}

export function mapDocument(row: PrismaDocument): HrDocument {
  return {
    id: row.id,
    employeeId: row.employeeId,
    title: row.title,
    category: row.category,
    uploadedAt: utcToIso(row.uploadedAt),
    storageKey: row.storageKey,
    isCompanyWide: row.isCompanyWide,
  };
}
