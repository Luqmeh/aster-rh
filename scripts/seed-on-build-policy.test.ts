import { describe, expect, it } from "vitest";
import { shouldRunHostedDemoSeed } from "./seed-on-build-policy";

describe("shouldRunHostedDemoSeed", () => {
  it("does not run by default", () => {
    expect(shouldRunHostedDemoSeed({ VERCEL_ENV: "production" }).run).toBe(
      false,
    );
  });

  it("runs only with flag on production", () => {
    expect(
      shouldRunHostedDemoSeed({
        VERCEL_ENV: "production",
        ASTER_SEED_ON_BUILD: "1",
      }),
    ).toEqual({
      run: true,
      reason: "ASTER_SEED_ON_BUILD=1 && VERCEL_ENV=production",
    });
  });

  it("ignores flag on preview", () => {
    expect(
      shouldRunHostedDemoSeed({
        VERCEL_ENV: "preview",
        ASTER_SEED_ON_BUILD: "1",
      }).run,
    ).toBe(false);
  });
});
