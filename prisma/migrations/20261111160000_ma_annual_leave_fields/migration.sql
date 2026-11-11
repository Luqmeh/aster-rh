-- Phase 3 — champs nécessaires au calcul CAP Maroc (art. 231 / 238).
-- Additive only.

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "birthDate" DATE,
  ADD COLUMN IF NOT EXISTS "activitySector" TEXT DEFAULT 'non_agricole';
