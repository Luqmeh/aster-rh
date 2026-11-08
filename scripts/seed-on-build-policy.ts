/**
 * Seed démo one-shot pendant un build Vercel Production.
 *
 * Opt-in strict : `ASTER_SEED_ON_BUILD=1` + `VERCEL_ENV=production`
 * (ou forçage local de test avec les deux variables).
 * Jamais activé par défaut — retirez la variable après le premier seed.
 */

export type EnvLike = Record<string, string | undefined>;

export type SeedOnBuildDecision = {
  run: boolean;
  reason: string;
};

export function shouldRunHostedDemoSeed(
  env: EnvLike = process.env,
): SeedOnBuildDecision {
  if (env.ASTER_SEED_ON_BUILD !== "1") {
    return { run: false, reason: "ASTER_SEED_ON_BUILD unset" };
  }

  if (env.VERCEL_ENV !== "production") {
    return {
      run: false,
      reason: `ASTER_SEED_ON_BUILD ignored (VERCEL_ENV=${env.VERCEL_ENV ?? "unset"})`,
    };
  }

  return {
    run: true,
    reason: "ASTER_SEED_ON_BUILD=1 && VERCEL_ENV=production",
  };
}
