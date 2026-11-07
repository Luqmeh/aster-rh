-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DemoRole" AS ENUM ('collaborateur', 'manager', 'admin_rh');

-- CreateEnum
CREATE TYPE "EmployeeCategory" AS ENUM ('cadre', 'non_cadre');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('cdi', 'cdd', 'alternance', 'stage');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('brouillon', 'soumise', 'en_attente_manager', 'en_attente_rh', 'approuvee', 'refusee', 'annulee');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('conges_payes', 'rtt', 'sans_solde', 'maladie', 'exceptionnel', 'parental');

-- CreateEnum
CREATE TYPE "TeleworkType" AS ENUM ('regulier', 'occasionnel', 'exceptionnel');

-- CreateTable
CREATE TABLE "OrganizationUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "demoIdentityId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "managerId" TEXT,
    "site" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "category" "EmployeeCategory" NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "phoneInternal" TEXT,
    "avatarInitials" TEXT NOT NULL,
    "teleworkEligible" BOOLEAN NOT NULL DEFAULT true,
    "teleworkDaysPerWeek" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "congesPayesAcquis" DOUBLE PRECISION NOT NULL,
    "congesPayesPris" DOUBLE PRECISION NOT NULL,
    "congesPayesRestants" DOUBLE PRECISION NOT NULL,
    "rttAcquis" DOUBLE PRECISION NOT NULL,
    "rttPris" DOUBLE PRECISION NOT NULL,
    "rttRestants" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "halfDayStart" BOOLEAN NOT NULL DEFAULT false,
    "halfDayEnd" BOOLEAN NOT NULL DEFAULT false,
    "daysCount" DOUBLE PRECISION NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "comment" TEXT,
    "managerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeleworkRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "TeleworkType" NOT NULL,
    "month" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" TEXT[],
    "status" "RequestStatus" NOT NULL,
    "reason" TEXT,
    "managerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeleworkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationItem" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT NOT NULL,
    "isCompanyWide" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HrDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUnit_code_key" ON "OrganizationUnit"("code");

-- CreateIndex
CREATE INDEX "OrganizationUnit_parentId_idx" ON "OrganizationUnit"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_demoIdentityId_idx" ON "Employee"("demoIdentityId");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_year_key" ON "LeaveBalance"("employeeId", "year");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_endDate_idx" ON "LeaveRequest"("endDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_status_idx" ON "LeaveRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "TeleworkRequest_employeeId_idx" ON "TeleworkRequest"("employeeId");

-- CreateIndex
CREATE INDEX "TeleworkRequest_status_idx" ON "TeleworkRequest"("status");

-- CreateIndex
CREATE INDEX "TeleworkRequest_month_idx" ON "TeleworkRequest"("month");

-- CreateIndex
CREATE INDEX "TeleworkRequest_employeeId_month_idx" ON "TeleworkRequest"("employeeId", "month");

-- CreateIndex
CREATE INDEX "TeleworkRequest_employeeId_status_idx" ON "TeleworkRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "NotificationItem_recipientId_idx" ON "NotificationItem"("recipientId");

-- CreateIndex
CREATE INDEX "NotificationItem_recipientId_read_idx" ON "NotificationItem"("recipientId", "read");

-- CreateIndex
CREATE INDEX "NotificationItem_createdAt_idx" ON "NotificationItem"("createdAt");

-- CreateIndex
CREATE INDEX "HrDocument_employeeId_idx" ON "HrDocument"("employeeId");

-- CreateIndex
CREATE INDEX "HrDocument_isCompanyWide_idx" ON "HrDocument"("isCompanyWide");

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeleworkRequest" ADD CONSTRAINT "TeleworkRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationItem" ADD CONSTRAINT "NotificationItem_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrDocument" ADD CONSTRAINT "HrDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

