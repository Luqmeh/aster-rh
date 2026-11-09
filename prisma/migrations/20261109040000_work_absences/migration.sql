-- CreateEnum
CREATE TYPE "AbsenceFamily" AS ENUM ('arret', 'conge_special');

-- CreateEnum
CREATE TYPE "WorkAbsenceCategory" AS ENUM (
  'arret_maladie',
  'accident_travail',
  'accident_trajet',
  'maladie_professionnelle',
  'conge_maternite',
  'conge_paternite',
  'conge_pathologique',
  'prolongation_arret',
  'rechute',
  'mariage_pacs',
  'naissance_adoption',
  'deces_proche',
  'demenagement',
  'hospitalisation_enfant',
  'annonce_handicap_ald',
  'rdv_medicaux_handicap',
  'preparation_examen_alternant'
);

-- CreateEnum
CREATE TYPE "WorkAbsenceStatus" AS ENUM (
  'declare',
  'en_attente_justificatif',
  'en_cours_verification',
  'informations_demandees',
  'enregistre',
  'termine',
  'refuse'
);

-- CreateEnum
CREATE TYPE "AbsenceDocumentKind" AS ENUM (
  'certificat_initial',
  'certificat_prolongation',
  'bulletin_hospitalisation',
  'dossier_at_mp',
  'calendrier_maternite',
  'notification_paternite',
  'justificatif_special',
  'autre'
);

-- CreateEnum
CREATE TYPE "ReturnVisitStatus" AS ENUM (
  'non_applicable',
  'a_planifier',
  'planifiee',
  'realisee',
  'non_requise'
);

-- CreateTable
CREATE TABLE "WorkAbsence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "family" "AbsenceFamily" NOT NULL,
    "category" "WorkAbsenceCategory" NOT NULL,
    "status" "WorkAbsenceStatus" NOT NULL DEFAULT 'declare',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysCount" DOUBLE PRECISION NOT NULL,
    "employeeComment" TEXT,
    "hrInternalNote" TEXT,
    "hrMessage" TEXT,
    "rejectionReason" TEXT,
    "parentAbsenceId" TEXT,
    "recurrenceOfId" TEXT,
    "dateGapFlag" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceWithin3MonthsFlag" BOOLEAN NOT NULL DEFAULT false,
    "requiresHrReview" BOOLEAN NOT NULL DEFAULT false,
    "hospitalAdmissionDate" TIMESTAMP(3),
    "hospitalDischargeDate" TIMESTAMP(3),
    "documentsReceived" BOOLEAN NOT NULL DEFAULT false,
    "firstDocumentReceivedAt" TIMESTAMP(3),
    "payrollProcessingMonth" TEXT,
    "expectedReturnDate" TIMESTAMP(3),
    "actualReturnDate" TIMESTAMP(3),
    "returnVisitRequired" BOOLEAN NOT NULL DEFAULT false,
    "returnVisitStatus" "ReturnVisitStatus" NOT NULL DEFAULT 'non_applicable',
    "returnVisitPlannedDate" TIMESTAMP(3),
    "returnVisitDeadline" TIMESTAMP(3),
    "processedByEmployeeId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAbsenceDocument" (
    "id" TEXT NOT NULL,
    "absenceId" TEXT NOT NULL,
    "kind" "AbsenceDocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedByEmployeeId" TEXT NOT NULL,
    "receivedByHrAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkAbsenceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAbsenceEvent" (
    "id" TEXT NOT NULL,
    "absenceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkAbsenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkAbsence_employeeId_idx" ON "WorkAbsence"("employeeId");
CREATE INDEX "WorkAbsence_status_idx" ON "WorkAbsence"("status");
CREATE INDEX "WorkAbsence_category_idx" ON "WorkAbsence"("category");
CREATE INDEX "WorkAbsence_family_idx" ON "WorkAbsence"("family");
CREATE INDEX "WorkAbsence_startDate_idx" ON "WorkAbsence"("startDate");
CREATE INDEX "WorkAbsence_endDate_idx" ON "WorkAbsence"("endDate");
CREATE INDEX "WorkAbsence_parentAbsenceId_idx" ON "WorkAbsence"("parentAbsenceId");
CREATE INDEX "WorkAbsence_employeeId_status_idx" ON "WorkAbsence"("employeeId", "status");
CREATE INDEX "WorkAbsenceDocument_absenceId_idx" ON "WorkAbsenceDocument"("absenceId");
CREATE INDEX "WorkAbsenceDocument_uploadedByEmployeeId_idx" ON "WorkAbsenceDocument"("uploadedByEmployeeId");
CREATE INDEX "WorkAbsenceEvent_absenceId_idx" ON "WorkAbsenceEvent"("absenceId");
CREATE INDEX "WorkAbsenceEvent_createdAt_idx" ON "WorkAbsenceEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "WorkAbsence" ADD CONSTRAINT "WorkAbsence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAbsence" ADD CONSTRAINT "WorkAbsence_parentAbsenceId_fkey" FOREIGN KEY ("parentAbsenceId") REFERENCES "WorkAbsence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkAbsence" ADD CONSTRAINT "WorkAbsence_recurrenceOfId_fkey" FOREIGN KEY ("recurrenceOfId") REFERENCES "WorkAbsence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkAbsence" ADD CONSTRAINT "WorkAbsence_processedByEmployeeId_fkey" FOREIGN KEY ("processedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkAbsenceDocument" ADD CONSTRAINT "WorkAbsenceDocument_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "WorkAbsence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAbsenceDocument" ADD CONSTRAINT "WorkAbsenceDocument_uploadedByEmployeeId_fkey" FOREIGN KEY ("uploadedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkAbsenceEvent" ADD CONSTRAINT "WorkAbsenceEvent_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "WorkAbsence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
