-- Phase 10 : cycle de vie employé, audit des rôles, recrutement.

CREATE TYPE "EmploymentStatus" AS ENUM ('actif', 'inactif', 'parti');

CREATE TYPE "RecruitmentStatus" AS ENUM (
  'brouillon',
  'soumis_revue',
  'refuse',
  'approuve',
  'intervieweur_assigne',
  'entretien_planifie',
  'entretien_termine'
);

ALTER TABLE "Employee"
  ADD COLUMN "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'actif',
  ADD COLUMN "departureDate" TIMESTAMP(3),
  ADD COLUMN "departureNote" TEXT;

-- Aligne le statut sur isActive existant (sans perte de données).
UPDATE "Employee"
SET "employmentStatus" = CASE
  WHEN "isActive" = true THEN 'actif'::"EmploymentStatus"
  ELSE 'inactif'::"EmploymentStatus"
END;

CREATE INDEX "Employee_employmentStatus_idx" ON "Employee"("employmentStatus");

CREATE TABLE "RoleChangeAudit" (
  "id" TEXT NOT NULL,
  "targetAccountId" TEXT NOT NULL,
  "previousRole" "DemoRole" NOT NULL,
  "newRole" "DemoRole" NOT NULL,
  "actorEmployeeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoleChangeAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoleChangeAudit_targetAccountId_idx" ON "RoleChangeAudit"("targetAccountId");
CREATE INDEX "RoleChangeAudit_actorEmployeeId_idx" ON "RoleChangeAudit"("actorEmployeeId");
CREATE INDEX "RoleChangeAudit_createdAt_idx" ON "RoleChangeAudit"("createdAt");

ALTER TABLE "RoleChangeAudit"
  ADD CONSTRAINT "RoleChangeAudit_targetAccountId_fkey"
  FOREIGN KEY ("targetAccountId") REFERENCES "UserAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoleChangeAudit"
  ADD CONSTRAINT "RoleChangeAudit_actorEmployeeId_fkey"
  FOREIGN KEY ("actorEmployeeId") REFERENCES "Employee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RecruitmentCandidate" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "positionTitle" TEXT NOT NULL,
  "departmentId" TEXT,
  "cvStorageKey" TEXT,
  "cvFileName" TEXT,
  "cvContentType" TEXT,
  "hrNotes" TEXT,
  "status" "RecruitmentStatus" NOT NULL DEFAULT 'brouillon',
  "submittedAt" TIMESTAMP(3),
  "createdByEmployeeId" TEXT NOT NULL,
  "decidedByEmployeeId" TEXT,
  "decisionComment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "interviewerEmployeeId" TEXT,
  "assignedByEmployeeId" TEXT,
  "assignedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecruitmentCandidate_status_idx" ON "RecruitmentCandidate"("status");
CREATE INDEX "RecruitmentCandidate_createdByEmployeeId_idx" ON "RecruitmentCandidate"("createdByEmployeeId");
CREATE INDEX "RecruitmentCandidate_interviewerEmployeeId_idx" ON "RecruitmentCandidate"("interviewerEmployeeId");
CREATE INDEX "RecruitmentCandidate_email_idx" ON "RecruitmentCandidate"("email");
CREATE INDEX "RecruitmentCandidate_positionTitle_idx" ON "RecruitmentCandidate"("positionTitle");
CREATE INDEX "RecruitmentCandidate_submittedAt_idx" ON "RecruitmentCandidate"("submittedAt");

ALTER TABLE "RecruitmentCandidate"
  ADD CONSTRAINT "RecruitmentCandidate_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "OrganizationUnit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentCandidate"
  ADD CONSTRAINT "RecruitmentCandidate_createdByEmployeeId_fkey"
  FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecruitmentCandidate"
  ADD CONSTRAINT "RecruitmentCandidate_decidedByEmployeeId_fkey"
  FOREIGN KEY ("decidedByEmployeeId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentCandidate"
  ADD CONSTRAINT "RecruitmentCandidate_interviewerEmployeeId_fkey"
  FOREIGN KEY ("interviewerEmployeeId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RecruitmentEvent" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecruitmentEvent_candidateId_idx" ON "RecruitmentEvent"("candidateId");
CREATE INDEX "RecruitmentEvent_createdAt_idx" ON "RecruitmentEvent"("createdAt");

ALTER TABLE "RecruitmentEvent"
  ADD CONSTRAINT "RecruitmentEvent_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "RecruitmentCandidate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
