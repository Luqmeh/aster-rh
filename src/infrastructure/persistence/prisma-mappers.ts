import type {
  AbsenceDocumentKind,
  AbsenceFamily,
  StoredContractType,
  DocumentRequest,
  DocumentRequestEvent,
  DocumentRequestStatus,
  DocumentRequestType,
  Employee,
  EmployeeGrade,
  EmploymentStatus,
  HrDocument,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  NotificationItem,
  OrganizationUnit,
  PeopleManagerEntry,
  RecruitmentCandidate,
  RecruitmentEvent,
  RecruitmentStatus,
  RequestStatus,
  ReturnVisitStatus,
  TeleworkRequest,
  TeleworkType,
  WorkAbsence,
  WorkAbsenceCategory,
  WorkAbsenceDocument,
  WorkAbsenceEvent,
  WorkAbsenceStatus,
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
  departmentId: string | null;
  peopleManagerId?: string | null;
  managerId: string | null;
  region?: string;
  site?: string;
  contractType: StoredContractType;
  grade?: EmployeeGrade;
  hireDate: Date;
  employmentStatus: EmploymentStatus;
  departureDate: Date | null;
  departureNote: string | null;
  isActive: boolean;
  phoneInternal: string | null;
  avatarInitials: string;
  teleworkEligible: boolean;
  teleworkDaysPerWeek: number;
  standardDailyHours: number;
  isPartTime?: boolean;
  weeklyContractHours?: number | null;
  workingTimePercent?: number | null;
  officeCalendarId?: string | null;
  policyGroup?: string | null;
  birthDate?: Date | null;
  activitySector?: string | null;
};

type PrismaPeopleManager = {
  id: string;
  displayName: string;
  linkedEmployeeId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  recoveryDaysAcquis: number;
  recoveryDaysPris: number;
  recoveryDaysRestants: number;
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

export function mapPeopleManager(row: PrismaPeopleManager): PeopleManagerEntry {
  return {
    id: row.id,
    displayName: row.displayName,
    linkedEmployeeId: row.linkedEmployeeId,
    isActive: row.isActive,
    createdAt: utcToIso(row.createdAt),
    updatedAt: utcToIso(row.updatedAt),
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
    departmentId: row.departmentId ?? null,
    peopleManagerId: row.peopleManagerId ?? null,
    managerId: row.managerId,
    region: (row.region && row.region.trim()) || row.site || "",
    contractType: row.contractType,
    grade: row.grade ?? "auditeur_junior",
    hireDate: utcToDateOnly(row.hireDate),
    employmentStatus: row.employmentStatus,
    departureDate: row.departureDate
      ? utcToDateOnly(row.departureDate)
      : null,
    departureNote: row.departureNote,
    isActive: row.isActive,
    phoneInternal: row.phoneInternal,
    avatarInitials: row.avatarInitials,
    teleworkEligible: row.teleworkEligible,
    teleworkDaysPerWeek: row.teleworkDaysPerWeek,
    standardDailyHours: row.standardDailyHours ?? 7,
    isPartTime: row.isPartTime ?? false,
    weeklyContractHours: row.weeklyContractHours ?? null,
    workingTimePercent: row.workingTimePercent ?? null,
    officeCalendarId: row.officeCalendarId ?? null,
    policyGroup: row.policyGroup ?? null,
    birthDate: row.birthDate ? utcToDateOnly(row.birthDate) : null,
    activitySector:
      row.activitySector === "agricole" ? "agricole" : "non_agricole",
  };
}

type PrismaRecruitmentCandidate = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  positionTitle: string;
  departmentId: string | null;
  cvStorageKey: string | null;
  cvFileName: string | null;
  cvContentType: string | null;
  hrNotes: string | null;
  status: RecruitmentStatus;
  submittedAt: Date | null;
  createdByEmployeeId: string;
  decidedByEmployeeId: string | null;
  decisionComment: string | null;
  decidedAt: Date | null;
  interviewerEmployeeId: string | null;
  assignedByEmployeeId: string | null;
  assignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaRecruitmentEvent = {
  id: string;
  candidateId: string;
  kind: string;
  message: string;
  actorId: string | null;
  createdAt: Date;
};

export function mapRecruitmentCandidate(
  row: PrismaRecruitmentCandidate,
): RecruitmentCandidate {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    positionTitle: row.positionTitle,
    departmentId: row.departmentId,
    cvStorageKey: row.cvStorageKey,
    cvFileName: row.cvFileName,
    cvContentType: row.cvContentType,
    hrNotes: row.hrNotes,
    status: row.status,
    submittedAt: row.submittedAt ? utcToIso(row.submittedAt) : null,
    createdByEmployeeId: row.createdByEmployeeId,
    decidedByEmployeeId: row.decidedByEmployeeId,
    decisionComment: row.decisionComment,
    decidedAt: row.decidedAt ? utcToIso(row.decidedAt) : null,
    interviewerEmployeeId: row.interviewerEmployeeId,
    assignedByEmployeeId: row.assignedByEmployeeId,
    assignedAt: row.assignedAt ? utcToIso(row.assignedAt) : null,
    createdAt: utcToIso(row.createdAt),
    updatedAt: utcToIso(row.updatedAt),
  };
}

export function mapRecruitmentEvent(
  row: PrismaRecruitmentEvent,
): RecruitmentEvent {
  return {
    id: row.id,
    candidateId: row.candidateId,
    kind: row.kind,
    message: row.message,
    actorId: row.actorId,
    createdAt: utcToIso(row.createdAt),
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
    recoveryDaysAcquis: row.recoveryDaysAcquis ?? 0,
    recoveryDaysPris: row.recoveryDaysPris ?? 0,
    recoveryDaysRestants: row.recoveryDaysRestants ?? 0,
  };
}

export function mapLeaveLedgerEntry(row: {
  id: string;
  employeeId: string;
  account: import("@/domain/types/leave-ledger").LeaveLedgerAccount;
  transactionType: import("@/domain/types/leave-ledger").LeaveLedgerTransactionType;
  quantity: { toString(): string } | string | number;
  unit: import("@/domain/types/leave-ledger").LeaveLedgerUnit;
  year: number;
  effectiveDate: Date;
  createdAt: Date;
  sourceKind: string;
  sourceId: string;
  reason: string;
  actorEmployeeId: string | null;
  reversesEntryId: string | null;
  metadataJson: unknown;
}): import("@/domain/types/leave-ledger").LeaveLedgerEntry {
  return {
    id: row.id,
    employeeId: row.employeeId,
    account: row.account,
    transactionType: row.transactionType,
    quantity: Number(row.quantity.toString()).toFixed(4),
    unit: row.unit,
    year: row.year,
    effectiveDate: utcToDateOnly(row.effectiveDate),
    createdAt: utcToIso(row.createdAt),
    sourceKind: row.sourceKind,
    sourceId: row.sourceId,
    reason: row.reason,
    actorEmployeeId: row.actorEmployeeId,
    reversesEntryId: row.reversesEntryId,
    metadataJson:
      row.metadataJson && typeof row.metadataJson === "object"
        ? (row.metadataJson as Record<string, unknown>)
        : null,
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

type PrismaDocumentRequest = {
  id: string;
  employeeId: string;
  documentType: DocumentRequestType;
  customLabel: string | null;
  reason: string;
  status: DocumentRequestStatus;
  hrMessage: string | null;
  hrInternalNote: string | null;
  storageKey: string | null;
  fileName: string | null;
  contentType: string | null;
  published: boolean;
  publishedAt: Date | null;
  processedByEmployeeId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaDocumentRequestEvent = {
  id: string;
  requestId: string;
  kind: string;
  message: string;
  actorId: string | null;
  createdAt: Date;
};

export function mapDocumentRequest(row: PrismaDocumentRequest): DocumentRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    documentType: row.documentType,
    customLabel: row.customLabel,
    reason: row.reason,
    status: row.status,
    hrMessage: row.hrMessage,
    hrInternalNote: row.hrInternalNote,
    storageKey: row.storageKey,
    fileName: row.fileName,
    contentType: row.contentType,
    published: row.published,
    publishedAt: row.publishedAt ? utcToIso(row.publishedAt) : null,
    processedByEmployeeId: row.processedByEmployeeId,
    createdAt: utcToIso(row.createdAt),
    updatedAt: utcToIso(row.updatedAt),
  };
}

export function mapDocumentRequestEvent(
  row: PrismaDocumentRequestEvent,
): DocumentRequestEvent {
  return {
    id: row.id,
    requestId: row.requestId,
    kind: row.kind,
    message: row.message,
    actorId: row.actorId,
    createdAt: utcToIso(row.createdAt),
  };
}

type PrismaWorkAbsence = {
  id: string;
  employeeId: string;
  family: AbsenceFamily;
  category: WorkAbsenceCategory;
  status: WorkAbsenceStatus;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  employeeComment: string | null;
  hrInternalNote: string | null;
  hrMessage: string | null;
  rejectionReason: string | null;
  parentAbsenceId: string | null;
  recurrenceOfId: string | null;
  dateGapFlag: boolean;
  recurrenceWithin3MonthsFlag: boolean;
  requiresHrReview: boolean;
  hospitalAdmissionDate: Date | null;
  hospitalDischargeDate: Date | null;
  documentsReceived: boolean;
  firstDocumentReceivedAt: Date | null;
  payrollProcessingMonth: string | null;
  expectedReturnDate: Date | null;
  actualReturnDate: Date | null;
  returnVisitRequired: boolean;
  returnVisitStatus: ReturnVisitStatus;
  returnVisitPlannedDate: Date | null;
  returnVisitDeadline: Date | null;
  processedByEmployeeId: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaWorkAbsenceDocument = {
  id: string;
  absenceId: string;
  kind: AbsenceDocumentKind;
  fileName: string;
  contentType: string;
  storageKey: string;
  uploadedByEmployeeId: string;
  receivedByHrAt: Date | null;
  createdAt: Date;
};

type PrismaWorkAbsenceEvent = {
  id: string;
  absenceId: string;
  kind: string;
  message: string;
  actorId: string | null;
  createdAt: Date;
};

export function mapWorkAbsence(row: PrismaWorkAbsence): WorkAbsence {
  return {
    id: row.id,
    employeeId: row.employeeId,
    family: row.family,
    category: row.category,
    status: row.status,
    startDate: utcToDateOnly(row.startDate),
    endDate: utcToDateOnly(row.endDate),
    daysCount: row.daysCount,
    employeeComment: row.employeeComment,
    hrInternalNote: row.hrInternalNote,
    hrMessage: row.hrMessage,
    rejectionReason: row.rejectionReason,
    parentAbsenceId: row.parentAbsenceId,
    recurrenceOfId: row.recurrenceOfId,
    dateGapFlag: row.dateGapFlag,
    recurrenceWithin3MonthsFlag: row.recurrenceWithin3MonthsFlag,
    requiresHrReview: row.requiresHrReview,
    hospitalAdmissionDate: row.hospitalAdmissionDate
      ? utcToDateOnly(row.hospitalAdmissionDate)
      : null,
    hospitalDischargeDate: row.hospitalDischargeDate
      ? utcToDateOnly(row.hospitalDischargeDate)
      : null,
    documentsReceived: row.documentsReceived,
    firstDocumentReceivedAt: row.firstDocumentReceivedAt
      ? utcToIso(row.firstDocumentReceivedAt)
      : null,
    payrollProcessingMonth: row.payrollProcessingMonth,
    expectedReturnDate: row.expectedReturnDate
      ? utcToDateOnly(row.expectedReturnDate)
      : null,
    actualReturnDate: row.actualReturnDate
      ? utcToDateOnly(row.actualReturnDate)
      : null,
    returnVisitRequired: row.returnVisitRequired,
    returnVisitStatus: row.returnVisitStatus,
    returnVisitPlannedDate: row.returnVisitPlannedDate
      ? utcToDateOnly(row.returnVisitPlannedDate)
      : null,
    returnVisitDeadline: row.returnVisitDeadline
      ? utcToDateOnly(row.returnVisitDeadline)
      : null,
    processedByEmployeeId: row.processedByEmployeeId,
    processedAt: row.processedAt ? utcToIso(row.processedAt) : null,
    createdAt: utcToIso(row.createdAt),
    updatedAt: utcToIso(row.updatedAt),
  };
}

export function mapWorkAbsenceDocument(
  row: PrismaWorkAbsenceDocument,
): WorkAbsenceDocument {
  return {
    id: row.id,
    absenceId: row.absenceId,
    kind: row.kind,
    fileName: row.fileName,
    contentType: row.contentType,
    storageKey: row.storageKey,
    uploadedByEmployeeId: row.uploadedByEmployeeId,
    receivedByHrAt: row.receivedByHrAt ? utcToIso(row.receivedByHrAt) : null,
    createdAt: utcToIso(row.createdAt),
  };
}

export function mapWorkAbsenceEvent(
  row: PrismaWorkAbsenceEvent,
): WorkAbsenceEvent {
  return {
    id: row.id,
    absenceId: row.absenceId,
    kind: row.kind,
    message: row.message,
    actorId: row.actorId,
    createdAt: utcToIso(row.createdAt),
  };
}
