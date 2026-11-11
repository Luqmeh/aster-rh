-- Additive: lots d'import Excel RH (collaborateurs + soldes d'ouverture).

CREATE TABLE IF NOT EXISTS "HrImportBatch" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT,
    "createdByEmployeeId" TEXT NOT NULL,
    "confirmedByEmployeeId" TEXT,
    "updateExistingEmployees" BOOLEAN NOT NULL DEFAULT false,
    "columnMappingJson" JSONB NOT NULL DEFAULT '{}',
    "departmentMappingJson" JSONB NOT NULL DEFAULT '{}',
    "siteMappingJson" JSONB NOT NULL DEFAULT '{}',
    "previewSummaryJson" JSONB,
    "executionReportJson" JSONB,
    "worksheetNamesJson" JSONB NOT NULL DEFAULT '[]',
    "headersBySheetJson" JSONB NOT NULL DEFAULT '{}',
    "employeeDraftsJson" JSONB NOT NULL DEFAULT '[]',
    "balanceDraftsJson" JSONB NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "HrImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HrImportBatch_status_idx" ON "HrImportBatch"("status");
CREATE INDEX IF NOT EXISTS "HrImportBatch_createdAt_idx" ON "HrImportBatch"("createdAt");
CREATE INDEX IF NOT EXISTS "HrImportBatch_createdByEmployeeId_idx" ON "HrImportBatch"("createdByEmployeeId");
