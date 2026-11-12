-- Grade / People Manager / Région — préserve les fiches existantes (Amel, Kenza).

CREATE TYPE "EmployeeGrade" AS ENUM ('auditeur_junior', 'auditeur_senior', 'manager');

CREATE TABLE "PeopleManager" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "linkedEmployeeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PeopleManager_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PeopleManager_linkedEmployeeId_idx" ON "PeopleManager"("linkedEmployeeId");
CREATE INDEX "PeopleManager_displayName_idx" ON "PeopleManager"("displayName");
CREATE INDEX "PeopleManager_isActive_idx" ON "PeopleManager"("isActive");

ALTER TABLE "PeopleManager" ADD CONSTRAINT "PeopleManager_linkedEmployeeId_fkey"
  FOREIGN KEY ("linkedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Nouveaux champs (valeurs par défaut temporaires pour backfill).
ALTER TABLE "Employee" ADD COLUMN "peopleManagerId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "region" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Employee" ADD COLUMN "grade" "EmployeeGrade" NOT NULL DEFAULT 'auditeur_junior';

-- Site → Région : copie telle quelle (Casablanca reste Casablanca ; pas de mapping silencieux).
UPDATE "Employee" SET "region" = NULLIF(TRIM("site"), '') WHERE "region" = '' OR "region" IS NULL;
UPDATE "Employee" SET "region" = 'Non renseignée' WHERE "region" = '' OR "region" IS NULL;

-- Catégorie → Grade organisationnel (hypothèse démo Production : rôles direction → Manager).
-- Les autres valeurs historiques non_applicable / cadre / non_cadre → Auditeur senior (neutre).
UPDATE "Employee" e
SET "grade" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "UserAccount" u
    WHERE u."employeeId" = e."id"
      AND u."role" IN ('chef_de_projet', 'admin_rh')
  ) THEN 'manager'::"EmployeeGrade"
  WHEN e."category" = 'cadre' THEN 'auditeur_senior'::"EmployeeGrade"
  WHEN e."category" = 'non_cadre' THEN 'auditeur_junior'::"EmployeeGrade"
  ELSE 'auditeur_senior'::"EmployeeGrade"
END;

-- People Manager à partir de managerId existant (lien Employee si présent).
INSERT INTO "PeopleManager" ("id", "displayName", "linkedEmployeeId", "isActive", "createdAt", "updatedAt")
SELECT
  'pm-from-' || m."id",
  TRIM(BOTH FROM (m."firstName" || ' ' || m."lastName")),
  m."id",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Employee" m
WHERE EXISTS (SELECT 1 FROM "Employee" e WHERE e."managerId" = m."id")
ON CONFLICT ("id") DO NOTHING;

-- Si id collision avec cuid pattern : utiliser insert distinct sans ON CONFLICT sur PK custom.
-- (ci-dessus id déterministe pm-from-<employeeId>)

UPDATE "Employee" e
SET "peopleManagerId" = 'pm-from-' || e."managerId"
WHERE e."managerId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "PeopleManager" pm WHERE pm."id" = 'pm-from-' || e."managerId");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_peopleManagerId_fkey"
  FOREIGN KEY ("peopleManagerId") REFERENCES "PeopleManager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Employee_peopleManagerId_idx" ON "Employee"("peopleManagerId");
CREATE INDEX "Employee_region_idx" ON "Employee"("region");
CREATE INDEX "Employee_grade_idx" ON "Employee"("grade");

-- site / category / managerId conservés (colonnes legacy) — plus utilisés par l'application.
