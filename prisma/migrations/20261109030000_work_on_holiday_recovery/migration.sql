-- CreateEnum
CREATE TYPE "WorkOnHolidayStatus" AS ENUM (
  'en_attente',
  'approuvee',
  'refusee',
  'travail_effectue_a_confirmer',
  'confirmee_credit_appliquee'
);

CREATE TYPE "HolidayKind" AS ENUM ('national', 'religious', 'company');
CREATE TYPE "HolidayConfirmation" AS ENUM ('confirmed', 'provisional');

-- AlterEnum
ALTER TYPE "LeaveType" ADD VALUE 'recuperation';

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN "standardDailyHours" DOUBLE PRECISION NOT NULL DEFAULT 7;

-- AlterTable LeaveBalance
ALTER TABLE "LeaveBalance" ADD COLUMN "recoveryDaysAcquis" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LeaveBalance" ADD COLUMN "recoveryDaysPris" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LeaveBalance" ADD COLUMN "recoveryDaysRestants" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable HolidayOverride
CREATE TABLE "HolidayOverride" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "nameFr" TEXT NOT NULL,
    "kind" "HolidayKind" NOT NULL,
    "confirmation" "HolidayConfirmation" NOT NULL DEFAULT 'confirmed',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "year" INTEGER NOT NULL,
    "createdByEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HolidayOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HolidayOverride_sourceKey_year_key" ON "HolidayOverride"("sourceKey", "year");
CREATE INDEX "HolidayOverride_date_idx" ON "HolidayOverride"("date");
CREATE INDEX "HolidayOverride_year_idx" ON "HolidayOverride"("year");

ALTER TABLE "HolidayOverride" ADD CONSTRAINT "HolidayOverride_createdByEmployeeId_fkey"
  FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable RecoveryCreditLedger (before WorkOnHolidayRequest FK to it)
CREATE TABLE "RecoveryCreditLedger" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceRequestId" TEXT NOT NULL,
    "hoursConfirmed" DOUBLE PRECISION NOT NULL,
    "daysCredited" DOUBLE PRECISION NOT NULL,
    "dailyHoursUsed" DOUBLE PRECISION NOT NULL,
    "actorEmployeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryCreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecoveryCreditLedger_sourceRequestId_key" ON "RecoveryCreditLedger"("sourceRequestId");
CREATE INDEX "RecoveryCreditLedger_employeeId_idx" ON "RecoveryCreditLedger"("employeeId");
CREATE INDEX "RecoveryCreditLedger_year_idx" ON "RecoveryCreditLedger"("year");

ALTER TABLE "RecoveryCreditLedger" ADD CONSTRAINT "RecoveryCreditLedger_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryCreditLedger" ADD CONSTRAINT "RecoveryCreditLedger_actorEmployeeId_fkey"
  FOREIGN KEY ("actorEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable WorkOnHolidayRequest
CREATE TABLE "WorkOnHolidayRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "holidayDate" TIMESTAMP(3) NOT NULL,
    "holidaySourceKey" TEXT NOT NULL,
    "holidayName" TEXT NOT NULL,
    "plannedHours" DOUBLE PRECISION NOT NULL,
    "plannedStart" TEXT,
    "plannedEnd" TEXT,
    "reason" TEXT NOT NULL,
    "status" "WorkOnHolidayStatus" NOT NULL DEFAULT 'en_attente',
    "decidedByEmployeeId" TEXT,
    "decisionComment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "actualHours" DOUBLE PRECISION,
    "actualDeclaredAt" TIMESTAMP(3),
    "confirmedHours" DOUBLE PRECISION,
    "confirmedByEmployeeId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "creditLedgerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkOnHolidayRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkOnHolidayRequest_creditLedgerId_key" ON "WorkOnHolidayRequest"("creditLedgerId");
CREATE INDEX "WorkOnHolidayRequest_employeeId_idx" ON "WorkOnHolidayRequest"("employeeId");
CREATE INDEX "WorkOnHolidayRequest_holidayDate_idx" ON "WorkOnHolidayRequest"("holidayDate");
CREATE INDEX "WorkOnHolidayRequest_status_idx" ON "WorkOnHolidayRequest"("status");
CREATE INDEX "WorkOnHolidayRequest_employeeId_holidayDate_idx" ON "WorkOnHolidayRequest"("employeeId", "holidayDate");

ALTER TABLE "WorkOnHolidayRequest" ADD CONSTRAINT "WorkOnHolidayRequest_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOnHolidayRequest" ADD CONSTRAINT "WorkOnHolidayRequest_decidedByEmployeeId_fkey"
  FOREIGN KEY ("decidedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOnHolidayRequest" ADD CONSTRAINT "WorkOnHolidayRequest_confirmedByEmployeeId_fkey"
  FOREIGN KEY ("confirmedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOnHolidayRequest" ADD CONSTRAINT "WorkOnHolidayRequest_creditLedgerId_fkey"
  FOREIGN KEY ("creditLedgerId") REFERENCES "RecoveryCreditLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
