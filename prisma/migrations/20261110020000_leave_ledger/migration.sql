-- CreateEnum
CREATE TYPE "LeaveLedgerAccount" AS ENUM ('conges_payes', 'rtt', 'recuperation');

-- CreateEnum
CREATE TYPE "LeaveLedgerUnit" AS ENUM ('days', 'hours');

-- CreateEnum
CREATE TYPE "LeaveLedgerTransactionType" AS ENUM (
  'opening_balance',
  'accrual',
  'leave_consumption',
  'recovery_credit',
  'recovery_consumption',
  'carryover',
  'expiry',
  'hr_adjustment',
  'reversal'
);

-- CreateTable
CREATE TABLE "LeaveLedgerEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "account" "LeaveLedgerAccount" NOT NULL,
    "transactionType" "LeaveLedgerTransactionType" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" "LeaveLedgerUnit" NOT NULL DEFAULT 'days',
    "year" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorEmployeeId" TEXT,
    "reversesEntryId" TEXT,
    "metadataJson" JSONB,

    CONSTRAINT "LeaveLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveLedgerEntry_sourceKind_sourceId_transactionType_key"
  ON "LeaveLedgerEntry"("sourceKind", "sourceId", "transactionType");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_employeeId_account_year_idx"
  ON "LeaveLedgerEntry"("employeeId", "account", "year");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_employeeId_year_idx"
  ON "LeaveLedgerEntry"("employeeId", "year");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_effectiveDate_idx" ON "LeaveLedgerEntry"("effectiveDate");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_createdAt_idx" ON "LeaveLedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_sourceKind_sourceId_idx"
  ON "LeaveLedgerEntry"("sourceKind", "sourceId");

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry"
  ADD CONSTRAINT "LeaveLedgerEntry_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry"
  ADD CONSTRAINT "LeaveLedgerEntry_reversesEntryId_fkey"
  FOREIGN KEY ("reversesEntryId") REFERENCES "LeaveLedgerEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
