import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "prisma/migrations/20261111200000_lock_prisma_migrations_api_roles/migration.sql",
);

describe("lock _prisma_migrations API roles migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("revokes privileges from anon and authenticated", () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\._prisma_migrations FROM anon/i);
    expect(sql).toMatch(
      /REVOKE ALL ON TABLE public\._prisma_migrations FROM authenticated/i,
    );
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\._prisma_migrations FROM PUBLIC/i);
  });

  it("enables RLS without FORCE and without permissive policies", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\._prisma_migrations ENABLE ROW LEVEL SECURITY/i,
    );
    expect(sql).not.toMatch(/FORCE ROW LEVEL SECURITY/i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it("keeps the table in public (Prisma history location)", () => {
    expect(sql).toMatch(/public\._prisma_migrations/);
    expect(sql).not.toMatch(/ALTER TABLE .* SET SCHEMA/i);
    expect(sql).not.toMatch(/RENAME TO/i);
  });
});
