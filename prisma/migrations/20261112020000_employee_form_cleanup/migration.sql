-- Cleanup fiches collaborateur : Poste / Département non requis ; pas de drop destructif.
-- Matricule = Employee.id (aucune rename PK). Contrats cdd/alternance conservés en enum.

ALTER TABLE "Employee" ALTER COLUMN "jobTitle" SET DEFAULT '';

ALTER TABLE "Employee" ALTER COLUMN "departmentId" DROP NOT NULL;

-- Recréer la FK avec ON DELETE SET NULL (nullable).
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_departmentId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "OrganizationUnit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
