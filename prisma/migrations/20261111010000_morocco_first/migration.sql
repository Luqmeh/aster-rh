-- Morocco-first — migrations additives uniquement.
-- Ne touche pas aux écritures ledger ni aux mots de passe.

DO $$ BEGIN
  ALTER TYPE "EmployeeCategory" ADD VALUE IF NOT EXISTS 'non_applicable';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "policyGroup" TEXT;

ALTER TABLE "EntitlementPolicyVersion"
  ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT NOT NULL DEFAULT 'UNSET',
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "EntitlementPolicyVersion_jurisdiction_isActive_idx"
  ON "EntitlementPolicyVersion"("jurisdiction", "isActive");
