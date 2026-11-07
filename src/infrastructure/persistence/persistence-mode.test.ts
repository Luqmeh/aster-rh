import { describe, expect, it } from "vitest";
import {
  isDemoModeEnabled,
  resolvePersistenceMode,
} from "@/infrastructure/persistence/persistence-mode";

describe("resolvePersistenceMode", () => {
  it("defaults to memory in local development without DATABASE_URL", () => {
    expect(
      resolvePersistenceMode({
        NODE_ENV: "development",
      }),
    ).toBe("memory");
  });

  it("selects prisma when DATABASE_URL is present", () => {
    expect(
      resolvePersistenceMode({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://example",
      }),
    ).toBe("prisma");
  });

  it("honours explicit ASTER_PERSISTENCE", () => {
    expect(
      resolvePersistenceMode({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://example",
        ASTER_PERSISTENCE: "memory",
      }),
    ).toBe("memory");
  });

  it("rejects memory on Vercel without override", () => {
    expect(() =>
      resolvePersistenceMode({
        VERCEL: "1",
        NODE_ENV: "production",
        ASTER_PERSISTENCE: "memory",
      }),
    ).toThrow(/mémoire interdite/i);
  });

  it("rejects missing DATABASE_URL on Vercel runtime", () => {
    expect(() =>
      resolvePersistenceMode({
        VERCEL: "1",
        NODE_ENV: "production",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("allows memory during next production build without DB", () => {
    expect(
      resolvePersistenceMode({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }),
    ).toBe("memory");
  });

  it("requires DATABASE_URL when ASTER_PERSISTENCE=prisma", () => {
    expect(() =>
      resolvePersistenceMode({
        NODE_ENV: "development",
        ASTER_PERSISTENCE: "prisma",
      }),
    ).toThrow(/DATABASE_URL/);
  });
});

describe("isDemoModeEnabled", () => {
  it("defaults to demo", () => {
    expect(isDemoModeEnabled({})).toBe(true);
  });

  it("disables when ASTER_MODE is not demo", () => {
    expect(isDemoModeEnabled({ ASTER_MODE: "connected" })).toBe(false);
  });
});
