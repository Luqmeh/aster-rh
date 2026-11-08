import { describe, expect, it } from "vitest";
import { shouldRunHostedMigrateDeploy } from "./migrate-on-build-policy";

describe("shouldRunHostedMigrateDeploy", () => {
  it("runs on Vercel production", () => {
    expect(shouldRunHostedMigrateDeploy({ VERCEL_ENV: "production" })).toEqual({
      run: true,
      reason: "VERCEL_ENV=production",
    });
  });

  it("skips preview by default", () => {
    expect(shouldRunHostedMigrateDeploy({ VERCEL_ENV: "preview" }).run).toBe(
      false,
    );
  });

  it("skips when VERCEL_ENV is unset (local npm run build:vercel)", () => {
    expect(shouldRunHostedMigrateDeploy({}).run).toBe(false);
  });

  it("honours ASTER_MIGRATE_ON_BUILD=1", () => {
    expect(
      shouldRunHostedMigrateDeploy({
        VERCEL_ENV: "preview",
        ASTER_MIGRATE_ON_BUILD: "1",
      }),
    ).toEqual({ run: true, reason: "ASTER_MIGRATE_ON_BUILD=1" });
  });

  it("honours ASTER_SKIP_MIGRATE=1 over production", () => {
    expect(
      shouldRunHostedMigrateDeploy({
        VERCEL_ENV: "production",
        ASTER_SKIP_MIGRATE: "1",
      }),
    ).toEqual({ run: false, reason: "ASTER_SKIP_MIGRATE=1" });
  });
});
