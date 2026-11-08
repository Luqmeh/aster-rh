# ASTER — Progress Report

**Date:** 8 November 2026  
**Phase:** 7b — Automated Supabase migrations through Vercel (committed)  
**Product:** ASTER — Human Resources, connected.  
**Parent commit:** `174fd4973d38507b78b4ff7c7256342816c1e09b`  
**Context:** Board demo (13 November 2026) — dedicated ASTER Supabase; demo environment only.

---

## Summary

Production Vercel builds now run `prisma migrate deploy` once before `next build`. Preview/local builds skip migrate by default. Demo seed stays a controlled offline command. No remote migration was executed during implementation; quality checks were green before this commit.

---

## Architecture findings

| Topic | Finding |
|-------|---------|
| Vercel pre-deploy hook | None suitable — use Production build step |
| Local build | `npm run build` stays offline (`ASTER_BUILD_WITHOUT_DB=1`) |
| Hosted build | `vercel.json` → `npm run build:vercel` → `scripts/vercel-build.ts` |
| Queries | Pooled `DATABASE_URL` ← `POSTGRES_PRISMA_URL` |
| Migrations | Non-pooled `DIRECT_URL` ← `POSTGRES_URL_NON_POOLING` |
| Serverless | Do not run migrations |
| Concurrency | One Production build job + Prisma migrate advisory lock |
| Preview | Skips migrate unless `ASTER_MIGRATE_ON_BUILD=1` on a dedicated DB |

---

## Deployment workflow

**Production (`VERCEL_ENV=production`):** map env → `prisma generate` → `prisma migrate deploy` → fail build on error → `next build`.

**Preview / local `build:vercel`:** migrate skipped (`ASTER_SKIP_MIGRATE=1` also forces skip).

**Seed:** not in pipeline — `npm run db:seed` (`resetMutable: false` only).

---

## Files created / modified / deleted

### Created
- `vercel.json`
- `scripts/vercel-build.ts`
- `scripts/migrate-on-build-policy.ts`
- `scripts/migrate-on-build-policy.test.ts`
- `scripts/load-database-env.ts`
- `docs/PROGRESS.md` (this file — previous deleted first)

### Modified
- `package.json`, `package-lock.json` (`prisma` + `tsx` in `dependencies`; `build:vercel`)
- `scripts/with-prisma-env.ts`, `prisma/seed.ts`, `vitest.config.ts`
- `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, `README.md`, `.env.example`

### Deleted
- Previous `docs/PROGRESS.md`

### Excluded from commit
- Local notes / secrets (e.g. `docs/git ssh.txt`, `.env*`)

---

## Dependencies

| Package | Change |
|---------|--------|
| `prisma` | Moved to `dependencies` (Vercel production install) |
| `tsx` | Moved to `dependencies` (build scripts) |
| New packages | None |

---

## Environment requirements (Production)

- `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` (or `DATABASE_URL` + `DIRECT_URL`)
- `ASTER_PERSISTENCE=prisma`
- `ASTER_MODE=demo`
- Optional: `ASTER_MIGRATE_ON_BUILD`, `ASTER_SKIP_MIGRATE`

---

## Security safeguards

- No credential logging (source names only)
- No secrets committed
- Production-only migrate by default
- Hosted runtime refuses silent memory without `ASTER_ALLOW_MEMORY=1`

---

## Checks (already green before commit — not re-run)

| Check | Result |
|-------|--------|
| `npm test` | 117 passed, 1 skipped |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run build:vercel` (local) | Pass — migrate skipped (`VERCEL_ENV=unset`) |
| Remote migrate | Not executed yet |

---

## Known issues / blockers

1. Schema not applied on Supabase until a Production deploy with this pipeline succeeds.
2. One controlled `npm run db:seed` still needed after first migrate.
3. Confirm Vercel dashboard Build Command does not override `vercel.json`.

---

## Exact next step

**Confirm Vercel Production env (`POSTGRES_*`, `ASTER_PERSISTENCE=prisma`, `ASTER_MODE=demo`), let the Production deploy run `migrate deploy`, verify build logs, then run one `npm run db:seed` and validate Léa→Julien persistence.**
