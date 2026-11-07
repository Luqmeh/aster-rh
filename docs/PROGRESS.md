# ASTER — Progress Report

**Date:** 7 November 2026  
**Phase:** 6 — Demo hardening and persistent storage  
**Product:** ASTER — Human Resources, connected.  
**Context:** Board demo preparation (13 November 2026) — demonstration environment, not production HR.

---

## Initial persistence architecture findings

| Question | Finding |
|---|---|
| Prisma configured? | Schema existed targeting PostgreSQL; **no migrations** before this phase. |
| PostgreSQL partially implemented? | **No** runtime adapter — only `demo-hr-repository` + in-memory `demo-store`. |
| Domain entities | Employees, org units, leave balances/requests, telework requests, notifications, documents, demo identities (seed). |
| In-memory only (before) | All mutable HR workflow data. |
| Migrations | None previously; initial migration added this phase. |
| Supabase / env credentials | **No** `.env` / `.env.local` present in this workspace. `DATABASE_URL` / `DIRECT_URL`: **missing**. |
| Multi-instance safe? | Memory store was **not** safe for multiple Vercel instances. Prisma path is. |

Calendar events remain **derived** from leave + telework (no duplicate calendar table) — preserved.

---

## Changes implemented

- Prisma schema hardened (fixed seed IDs, indexes, `directUrl`, cascade rules).
- Initial SQL migration `prisma/migrations/20261107120000_init_aster`.
- `prismaHrRepository` implementing `HrRepository` (domain dates ↔ UTC DateTime mappers).
- Persistence mode resolver: memory (local) vs prisma (when `DATABASE_URL` / explicit); **memory forbidden** on Vercel/production runtime unless `ASTER_ALLOW_MEMORY=1`.
- Build remains offline-capable via `ASTER_BUILD_WITHOUT_DB=1` in `npm run build`.
- Idempotent seed + demo reset (ASTER tables only, gated by `ASTER_MODE=demo`).
- Container wires the correct repository.
- Paramètres UI shows persistence mode + reset success feedback.
- Docs: `docs/DEPLOYMENT.md`, updates to README / ARCHITECTURE / AGENTS / ROADMAP / `.env.example`.

---

## Entities persisted

| Entity | Persisted | Notes |
|---|---|---|
| OrganizationUnit | Yes | Seed upsert |
| Employee (+ demoIdentityId) | Yes | Léa, Julien, Camille + fictional peers |
| LeaveBalance | Yes | |
| LeaveRequest | Yes | Status + manager comments |
| TeleworkRequest | Yes | Month, days[], rejection reason in `managerComment` |
| NotificationItem | Yes | Per recipient + read flag |
| HrDocument | Yes | Metadata only (mock storage) |
| CalendarEvent | **No table** | Derived at read time |
| DemoIdentity | Seed/code | Cookie switch; IDs aligned with employees |

---

## Files created / modified / deleted

### Created
- `src/infrastructure/persistence/prisma-client.ts`
- `src/infrastructure/persistence/prisma-mappers.ts`
- `src/infrastructure/persistence/prisma-mappers.test.ts`
- `src/infrastructure/persistence/prisma-hr-repository.ts`
- `src/infrastructure/persistence/prisma-hr-repository.integration.test.ts`
- `src/infrastructure/persistence/persistence-mode.ts`
- `src/infrastructure/persistence/persistence-mode.test.ts`
- `src/infrastructure/persistence/demo-data-lifecycle.ts`
- `prisma/seed.ts`
- `prisma/migrations/20261107120000_init_aster/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `docs/DEPLOYMENT.md`
- `docs/PROGRESS.md` (this file — previous deleted first)

### Modified
- `prisma/schema.prisma`
- `src/infrastructure/container.ts`
- `src/app/actions/demo.ts`
- `src/app/(app)/parametres/page.tsx`
- `package.json` (scripts, `tsx`, prisma seed, postinstall generate)
- `.env.example`
- `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`

### Deleted
- Previous `docs/PROGRESS.md` (replaced entirely)

### Dependencies
- Added **devDependency**: `tsx` (Prisma seed runner).
- No new runtime ORM/database libraries (Prisma already present).

---

## Seed and reset behaviour

- **Seed** (`npm run db:seed`): upserts departments, employees, balances, and demo leave/telework/notifications/documents with stable IDs — re-run does not duplicate identities.
- **Reset UI** (Paramètres): only when `ASTER_MODE=demo`; clears mutable ASTER request/notification/document rows then reseeds; memory mode calls `resetDemoStore()`.
- Not a general-purpose database wipe.

---

## Security and authorization measures

- Existing server-side approval rules unchanged (collaborator cannot approve; ownership checks; telework edit only while pending; rejection reason required).
- Reset gated by demo mode.
- DB credentials server-side only; never sent to client components.
- No real employee data introduced.
- Production/Vercel refuses silent memory fallback.

---

## Database configuration status (no secrets)

| Item | Status |
|---|---|
| `.env` / `.env.local` | **Absent** |
| `DATABASE_URL` | **Missing** |
| `DIRECT_URL` | **Missing** |
| Local Docker/Postgres | **Unavailable** in this environment |
| Remote ASTER DB tested | **No** |
| Migration applied to a live DB | **No** (SQL prepared only) |
| Seed executed against a live DB | **No** |

---

## Test results (executed 7 Nov 2026)

| Check | Result |
|---|---|
| `npm test` | **103 passed**, **1 skipped** (Prisma integration — no `ASTER_TEST_DATABASE_URL`), 17 files |
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** |
| `npm run build` | **Pass** (with `ASTER_BUILD_WITHOUT_DB=1`) |
| Prisma integration against live DB | **Not run** (no isolated test database) |
| Remote DB connectivity | **Not tested** |

---

## Known issues / blockers

1. **Blocker for durable hosted demo:** no ASTER PostgreSQL credentials/instance in this environment.
2. Integration tests are written but skip without `ASTER_TEST_DATABASE_URL`.
3. Auth session employee snapshot still comes from seed module (IDs aligned with DB); mutable workflow data goes through `HrRepository`.
4. Not deployment-ready until a dedicated ASTER database is provisioned, migrated, seeded, and smoke-tested.

---

## Exact remaining deployment steps

1. Create a **dedicated** Supabase/PostgreSQL project for ASTER.
2. Set `DATABASE_URL` (pooler) + `DIRECT_URL` (direct) in `.env.local` and Vercel env.
3. Set `ASTER_PERSISTENCE=prisma` and `ASTER_MODE=demo`.
4. Run `npm run db:migrate` then `npm run db:seed` against that database.
5. Smoke-test leave + telework + approval + calendar; restart app and confirm persistence.
6. Optionally set `ASTER_TEST_DATABASE_URL` to an isolated DB and re-run `npm test`.
7. Deploy to Vercel only after step 5 succeeds.

---

## Exact next recommended implementation step

**Provision an ASTER-only PostgreSQL database, place `DATABASE_URL` + `DIRECT_URL` in `.env.local` (do not commit), run `npm run db:migrate && npm run db:seed`, then verify Léa→Julien leave/telework persistence across an application restart.**
