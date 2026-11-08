-- Hiérarchie définitive : collaborateur | chef_de_projet | admin_rh
-- Migre l'ancien rôle "manager" → "chef_de_projet" sans perte de données.

CREATE TYPE "DemoRole_new" AS ENUM ('collaborateur', 'chef_de_projet', 'admin_rh');

ALTER TABLE "UserAccount"
  ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "UserAccount"
  ALTER COLUMN "role" TYPE "DemoRole_new"
  USING (
    CASE
      WHEN "role"::text = 'manager' THEN 'chef_de_projet'
      WHEN "role"::text = 'admin_rh' THEN 'admin_rh'
      ELSE 'collaborateur'
    END
  )::"DemoRole_new";

DROP TYPE "DemoRole";

ALTER TYPE "DemoRole_new" RENAME TO "DemoRole";
