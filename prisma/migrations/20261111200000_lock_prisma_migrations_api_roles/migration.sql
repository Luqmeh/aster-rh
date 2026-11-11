-- Lock Prisma migration metadata away from Supabase Data API roles.
-- Finding: Security Advisor rls_disabled_in_public on public._prisma_migrations
--
-- Intent:
--   * Keep the table in public (Prisma migrate history expects this location).
--   * Revoke ALL privileges from anon / authenticated / PUBLIC.
--   * Enable RLS with ZERO policies (deny for non-owners; not a permissive policy).
--   * Do NOT FORCE RLS — the table owner / Prisma migration role must keep access.
--   * Preserve migrate deploy / migrate status for the deployment connection role.
--
-- Safe on non-Supabase Postgres: role existence is checked before REVOKE.

DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NULL THEN
    RAISE NOTICE 'public._prisma_migrations absent — skip lock-down.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public._prisma_migrations FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public._prisma_migrations FROM authenticated';
  END IF;

  -- Defense against default PUBLIC grants on some Postgres setups.
  EXECUTE 'REVOKE ALL ON TABLE public._prisma_migrations FROM PUBLIC';

  -- Deny-by-default for non-owners via Data API. Owner (Prisma migrate role) bypasses RLS.
  EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';
END
$$;
