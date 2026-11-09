-- CreateEnum
CREATE TYPE "DocumentRequestType" AS ENUM (
  'attestation_travail',
  'attestation_employeur',
  'attestation_remuneration',
  'copie_contrat',
  'copie_avenant',
  'attestation_formation',
  'attestation_cncc',
  'certificat_travail',
  'attestation_france_travail',
  'recu_solde_tout_compte',
  'autre'
);

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM (
  'en_attente',
  'en_traitement',
  'informations_demandees',
  'document_disponible',
  'refusee'
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "documentType" "DocumentRequestType" NOT NULL,
    "customLabel" TEXT,
    "reason" TEXT NOT NULL,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'en_attente',
    "hrMessage" TEXT,
    "hrInternalNote" TEXT,
    "storageKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "processedByEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRequest_employeeId_idx" ON "DocumentRequest"("employeeId");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- CreateIndex
CREATE INDEX "DocumentRequest_documentType_idx" ON "DocumentRequest"("documentType");

-- CreateIndex
CREATE INDEX "DocumentRequest_employeeId_status_idx" ON "DocumentRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "DocumentRequest_createdAt_idx" ON "DocumentRequest"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentRequestEvent_requestId_idx" ON "DocumentRequestEvent"("requestId");

-- CreateIndex
CREATE INDEX "DocumentRequestEvent_createdAt_idx" ON "DocumentRequestEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_processedByEmployeeId_fkey" FOREIGN KEY ("processedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestEvent" ADD CONSTRAINT "DocumentRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
