# ASTER — Progress Report

**Date:** 8 November 2026  
**Phase:** 7c — One-time Production demo seed (Vercel-hosted)  
**Product:** ASTER — Human Resources, connected.  
**Parent:** `a52e72406e3891c61f2ae303ca12bab3b0b6b53d`  
**Context:** Board demo — dedicated ASTER Supabase; no local credential copy; no public seed API.

---

## Summary

Prepared a **Production-only, opt-in** demo seed that runs on the Vercel build machine using existing Supabase integration env vars (`POSTGRES_*`). Seed is idempotent create-or-keep (no DELETE/DROP/TRUNCATE). Léa / Julien / Camille are verified after seed. **Remote seed has not executed yet** — requires the manual Vercel flag + Redeploy below (this agent cannot reach Production DB without copying secrets or Vercel CLI).

---

## Changes

| Change | Detail |
|--------|--------|
| Preserve-on-seed | `seedAsterDemoData` without `resetMutable` uses `update: {}` (create-or-keep) |
| One-shot gate | `ASTER_SEED_ON_BUILD=1` **and** `VERCEL_ENV=production` |
| Build hook | `vercel-build.ts` runs `prisma/seed.ts` + `verify-demo-seed.ts` after migrate when gated |
| Verify | Checks `emp-lea`, `emp-julien`, `emp-camille` + counts (no secrets logged) |
| Migrate pipeline | **Unchanged** (seed is separate opt-in step after migrate) |

### Files
- Created: `scripts/seed-on-build-policy.ts`, `scripts/seed-on-build-policy.test.ts`, `scripts/verify-demo-seed.ts`, `docs/PROGRESS.md`
- Modified: `demo-data-lifecycle.ts`, `vercel-build.ts`, `docs/DEPLOYMENT.md`, `.env.example`
- Deleted: previous `docs/PROGRESS.md`
- Excluded: `docs/git ssh.txt`, any `.env*`

### Dependencies
None added.

---

## Checks

| Check | Result |
|-------|--------|
| Targeted Vitest (seed + migrate policies) | **8 passed** |
| Full suite / typecheck / lint / build | Not re-run (per scope: avoid extensive runs) |
| Remote Production seed | **Pending** manual Vercel one-shot |
| Destructive reset | Not run |

---

## Remaining issues

1. Seed not applied until `ASTER_SEED_ON_BUILD=1` is set on Vercel Production and a Production deploy runs.
2. After success, the flag must be removed so later deploys stay seed-free.
3. Persistence UX check (Léa→Julien) still needed on the live app after seed.

---

## Exact next step (manual — only action required)

1. Vercel → ASTER project → **Settings → Environment Variables → Production** → add `ASTER_SEED_ON_BUILD` = `1`
2. **Deployments → Redeploy** the latest Production deployment  
3. Confirm build logs show seed + `OK emp-lea / Léa`, `OK emp-julien / Julien`, `OK emp-camille / Camille`
4. **Delete** `ASTER_SEED_ON_BUILD`
5. Open the Production app and confirm Léa / Julien / Camille demo data persists across reload
