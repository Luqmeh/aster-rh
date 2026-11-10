-- Phase 2 — politiques d'acquisition, calendriers bureau, lots d'accrual, reports CP.
-- Migration additive uniquement (pas de DROP / TRUNCATE).

-- Enums ledger / politiques
ALTER TYPE "LeaveLedgerAccount" ADD VALUE IF NOT EXISTS 'conges_payes_acquis';
ALTER TYPE "LeaveLedgerAccount" ADD VALUE IF NOT EXISTS 'conges_payes_en_acquisition';

DO $$ BEGIN
  CREATE TYPE "EntitlementPolicyKind" AS ENUM (
    'conges_payes',
    'rtt',
    'recuperation_usage',
    'special_leave',
    'carryover_cp',
    'expiry_rtt'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EntitlementValidationStatus" AS ENUM (
    'guide_documented',
    'requires_hr_decision',
    'hr_configured',
    'draft'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccrualBatchStatus" AS ENUM ('preview', 'posted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CarryoverRequestStatus" AS ENUM (
    'brouillon',
    'en_attente_validation',
    'approuvee',
    'refusee'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Champs employee (éligibilité / temps partiel / calendrier)
ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "isPartTime" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "weeklyContractHours" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "workingTimePercent" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "officeCalendarId" TEXT;

-- OfficeWorkCalendar
CREATE TABLE IF NOT EXISTS "OfficeWorkCalendar" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "siteKey" TEXT,
  "workingHolidays" JSONB NOT NULL DEFAULT '[]',
  "validationStatus" "EntitlementValidationStatus" NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficeWorkCalendar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OfficeWorkCalendar_code_key" ON "OfficeWorkCalendar"("code");
CREATE INDEX IF NOT EXISTS "OfficeWorkCalendar_siteKey_idx" ON "OfficeWorkCalendar"("siteKey");

DO $$ BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_officeCalendarId_fkey"
    FOREIGN KEY ("officeCalendarId") REFERENCES "OfficeWorkCalendar"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EntitlementPolicy
CREATE TABLE IF NOT EXISTS "EntitlementPolicy" (
  "id" TEXT NOT NULL,
  "kind" "EntitlementPolicyKind" NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EntitlementPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EntitlementPolicy_code_key" ON "EntitlementPolicy"("code");

CREATE TABLE IF NOT EXISTS "EntitlementPolicyVersion" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "validationStatus" "EntitlementValidationStatus" NOT NULL DEFAULT 'draft',
  "rulesJson" JSONB NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "notes" TEXT,
  "createdByEmployeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntitlementPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EntitlementPolicyVersion_policyId_version_key"
  ON "EntitlementPolicyVersion"("policyId", "version");
CREATE INDEX IF NOT EXISTS "EntitlementPolicyVersion_effectiveFrom_idx"
  ON "EntitlementPolicyVersion"("effectiveFrom");
CREATE INDEX IF NOT EXISTS "EntitlementPolicyVersion_validationStatus_idx"
  ON "EntitlementPolicyVersion"("validationStatus");

DO $$ BEGIN
  ALTER TABLE "EntitlementPolicyVersion"
    ADD CONSTRAINT "EntitlementPolicyVersion_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "EntitlementPolicy"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AccrualBatch / AccrualLine
CREATE TABLE IF NOT EXISTS "AccrualBatch" (
  "id" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" "AccrualBatchStatus" NOT NULL DEFAULT 'preview',
  "createdByEmployeeId" TEXT,
  "postedByEmployeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "AccrualBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccrualBatch_periodKey_idx" ON "AccrualBatch"("periodKey");
CREATE INDEX IF NOT EXISTS "AccrualBatch_status_idx" ON "AccrualBatch"("status");
CREATE INDEX IF NOT EXISTS "AccrualBatch_createdAt_idx" ON "AccrualBatch"("createdAt");

CREATE TABLE IF NOT EXISTS "AccrualLine" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "account" "LeaveLedgerAccount" NOT NULL,
  "policyVersionId" TEXT,
  "periodKey" TEXT NOT NULL,
  "quantity" DECIMAL(12,4) NOT NULL,
  "calculationStatus" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "warningsJson" JSONB NOT NULL DEFAULT '[]',
  "idempotencyKey" TEXT NOT NULL,
  "ledgerEntryId" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccrualLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccrualLine_idempotencyKey_key" ON "AccrualLine"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AccrualLine_batchId_idx" ON "AccrualLine"("batchId");
CREATE INDEX IF NOT EXISTS "AccrualLine_employeeId_periodKey_idx" ON "AccrualLine"("employeeId", "periodKey");
CREATE INDEX IF NOT EXISTS "AccrualLine_calculationStatus_idx" ON "AccrualLine"("calculationStatus");

DO $$ BEGIN
  ALTER TABLE "AccrualLine"
    ADD CONSTRAINT "AccrualLine_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "AccrualBatch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AccrualLine"
    ADD CONSTRAINT "AccrualLine_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AccrualLine"
    ADD CONSTRAINT "AccrualLine_policyVersionId_fkey"
    FOREIGN KEY ("policyVersionId") REFERENCES "EntitlementPolicyVersion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CarryoverRequest
CREATE TABLE IF NOT EXISTS "CarryoverRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sourcePeriodKey" TEXT NOT NULL,
  "targetPeriodKey" TEXT NOT NULL,
  "requestedDays" DECIMAL(12,4) NOT NULL,
  "status" "CarryoverRequestStatus" NOT NULL DEFAULT 'brouillon',
  "exceptionReason" TEXT,
  "leavePlanThrough" DATE,
  "partnerApprovedById" TEXT,
  "partnerApprovedAt" TIMESTAMP(3),
  "rrhForwardedAt" TIMESTAMP(3),
  "decidedByEmployeeId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "ledgerCarryoverEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarryoverRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CarryoverRequest_employeeId_idx" ON "CarryoverRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "CarryoverRequest_status_idx" ON "CarryoverRequest"("status");
CREATE INDEX IF NOT EXISTS "CarryoverRequest_sourcePeriodKey_idx" ON "CarryoverRequest"("sourcePeriodKey");

DO $$ BEGIN
  ALTER TABLE "CarryoverRequest"
    ADD CONSTRAINT "CarryoverRequest_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
