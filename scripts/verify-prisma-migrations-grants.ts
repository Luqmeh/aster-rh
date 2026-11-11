/**
 * Vérifie que public._prisma_migrations n'est pas exposé aux rôles Data API
 * (anon / authenticated), tout en restant accessible au rôle de connexion Prisma.
 *
 * Usage :
 *   npx tsx scripts/with-prisma-env.ts # (prérequis DATABASE_URL/DIRECT_URL)
 *   npx tsx scripts/verify-prisma-migrations-grants.ts
 *
 * Ne logue jamais les secrets ni le contenu des migrations.
 */
import { PrismaClient } from "@prisma/client";
import { loadDatabaseEnv, getDatabaseEnvReadiness } from "./load-database-env";

type GrantRow = {
  grantee: string;
  privilege_type: string;
};

type RlsRow = {
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
};

async function main() {
  loadDatabaseEnv();
  const readiness = getDatabaseEnvReadiness();
  if (!readiness.hasDatabaseUrl) {
    console.error(
      "DATABASE_URL / POSTGRES_PRISMA_URL manquant — impossible de vérifier les grants.",
    );
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const exists = await prisma.$queryRaw<Array<{ present: boolean }>>`
      SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present
    `;
    if (!exists[0]?.present) {
      console.error("Table public._prisma_migrations introuvable.");
      process.exit(1);
    }

    const grants = await prisma.$queryRaw<GrantRow[]>`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')
      ORDER BY grantee, privilege_type
    `;

    const rls = await prisma.$queryRaw<RlsRow[]>`
      SELECT c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations'
    `;

    const ownerCanSelect = await prisma.$queryRaw<
      Array<{ migration_name: string }>
    >`
      SELECT migration_name
      FROM public._prisma_migrations
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1
    `;

    console.log(
      JSON.stringify(
        {
          table: "public._prisma_migrations",
          apiRoleGrants: grants,
          rowLevelSecurityEnabled: Boolean(rls[0]?.relrowsecurity),
          forceRowLevelSecurity: Boolean(rls[0]?.relforcerowsecurity),
          prismaRoleCanSelect: ownerCanSelect.length > 0,
          latestMigrationSample: ownerCanSelect[0]?.migration_name ?? null,
        },
        null,
        2,
      ),
    );

    const bad = grants.filter((g) =>
      ["anon", "authenticated", "PUBLIC"].includes(g.grantee),
    );
    if (bad.length > 0) {
      console.error(
        "ÉCHEC : des privilèges API restent sur _prisma_migrations :",
        bad.map((g) => `${g.grantee}:${g.privilege_type}`).join(", "),
      );
      process.exit(1);
    }
    if (!rls[0]?.relrowsecurity) {
      console.error("ÉCHEC : RLS n'est pas activé sur _prisma_migrations.");
      process.exit(1);
    }
    if (rls[0]?.relforcerowsecurity) {
      console.error(
        "ÉCHEC : FORCE ROW LEVEL SECURITY est actif — risque de casser prisma migrate.",
      );
      process.exit(1);
    }
    if (ownerCanSelect.length === 0) {
      console.error(
        "ÉCHEC : le rôle Prisma ne peut pas lire _prisma_migrations (migrate status cassé).",
      );
      process.exit(1);
    }

    console.log(
      "OK — anon/authenticated/PUBLIC sans grants ; RLS ON (sans FORCE) ; rôle Prisma OK.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
