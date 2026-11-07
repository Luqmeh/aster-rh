import { describe, expect, it } from "vitest";
import {
  applyPrismaDatabaseEnvFallbacks,
  resolveDatabaseUrl,
  resolveDirectUrl,
} from "@/infrastructure/persistence/database-env";

describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL over POSTGRES_PRISMA_URL", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgresql://local-pooled",
        POSTGRES_PRISMA_URL: "postgresql://vercel-pooled",
      }),
    ).toBe("postgresql://local-pooled");
  });

  it("falls back to POSTGRES_PRISMA_URL", () => {
    expect(
      resolveDatabaseUrl({
        POSTGRES_PRISMA_URL: "postgresql://vercel-pooled",
      }),
    ).toBe("postgresql://vercel-pooled");
  });

  it("ignores blank DATABASE_URL", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "   ",
        POSTGRES_PRISMA_URL: "postgresql://vercel-pooled",
      }),
    ).toBe("postgresql://vercel-pooled");
  });
});

describe("resolveDirectUrl", () => {
  it("prefers DIRECT_URL over POSTGRES_URL_NON_POOLING", () => {
    expect(
      resolveDirectUrl({
        DIRECT_URL: "postgresql://local-direct",
        POSTGRES_URL_NON_POOLING: "postgresql://vercel-direct",
      }),
    ).toBe("postgresql://local-direct");
  });

  it("falls back to POSTGRES_URL_NON_POOLING", () => {
    expect(
      resolveDirectUrl({
        POSTGRES_URL_NON_POOLING: "postgresql://vercel-direct",
      }),
    ).toBe("postgresql://vercel-direct");
  });
});

describe("applyPrismaDatabaseEnvFallbacks", () => {
  it("writes Prisma schema names from Vercel Supabase vars", () => {
    const env: Record<string, string | undefined> = {
      POSTGRES_PRISMA_URL: "postgresql://vercel-pooled",
      POSTGRES_URL_NON_POOLING: "postgresql://vercel-direct",
    };

    applyPrismaDatabaseEnvFallbacks(env);

    expect(env.DATABASE_URL).toBe("postgresql://vercel-pooled");
    expect(env.DIRECT_URL).toBe("postgresql://vercel-direct");
  });

  it("does not overwrite explicit local DATABASE_URL / DIRECT_URL", () => {
    const env: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://local-pooled",
      DIRECT_URL: "postgresql://local-direct",
      POSTGRES_PRISMA_URL: "postgresql://vercel-pooled",
      POSTGRES_URL_NON_POOLING: "postgresql://vercel-direct",
    };

    applyPrismaDatabaseEnvFallbacks(env);

    expect(env.DATABASE_URL).toBe("postgresql://local-pooled");
    expect(env.DIRECT_URL).toBe("postgresql://local-direct");
  });
});
