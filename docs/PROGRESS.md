# ASTER — Progress Report

**Date:** 10 novembre 2026  
**Focus:** Phase 1 — Leave Ledger & authoritative balance engine (delivery completion)  
**Branch:** `main`  
**Production migrate / deploy:** **not verified** in this session.

## Phase 1 summary

ASTER now has an append-only leave ledger as the authoritative source of truth for tracked leave accounts (CP, RTT, récupération).

- Existing `LeaveBalance` values are preserved via idempotent opening-balance backfill (acquis + / pris −); no invented historical movements.
- Pending leave requests reserve capacity logically but do **not** post ledger consumption.
- Approval posts a single idempotent consumption entry; recovery credits post only on confirmed WOH credit.
- HR/Chef adjustments append ledger entries with a mandatory reason; no silent overwrite of balances.
- Chef context panel, `/conges`, dashboard and Excel soldes read the same authoritative metrics.

## Files changed

| Area | Paths |
|------|--------|
| Schema / migration | `prisma/schema.prisma`, `prisma/migrations/20261110020000_leave_ledger/` |
| Domain | `src/domain/types/leave-ledger.ts`, `leave-decimal.ts`, `leave-ledger-balance.ts` (+ tests), `leave-approval-context.ts` (+ tests) |
| Application | `leave-ledger-service.ts` (+ tests), `leave-service.ts`, `work-on-holiday-service.ts`, `leave-approval-context-service.ts`, `dashboard-service.ts` |
| Infrastructure | `hr-repository.ts`, `demo-*`, `prisma-hr-repository.ts`, `prisma-mappers.ts`, `demo-data-lifecycle.ts`, `excel-exports.ts` |
| UI / actions | `employee-leave-context-panel.tsx`, `src/app/actions/leave-ledger.ts` |
| Docs | `docs/LEAVE_LEDGER.md`, `docs/ARCHITECTURE.md`, this `docs/PROGRESS.md` (fresh) |

**Excluded from commit:** `docs/git ssh.txt` (local SSH notes).

## Migration & backfill

- Additive Prisma migration only (enums + `LeaveLedgerEntry` table + indexes + FKs). No DROP/TRUNCATE of employee or leave tables.
- Backfill: `backfillOpeningBalancesFromSnapshots` / `ensureBackfill` from existing `LeaveBalance`; unique key `(sourceKind, sourceId, transactionType)` prevents duplicates.
- Demo/Prisma seed path also triggers backfill after balances are upserted.
- **Local verification:** unit/integration tests (seed Léa 25/8/17 preserved via openings). **Production DB migrate/backfill not executed here.**

## Test results (this delivery run)

Focused Vitest — **40/40 PASS**:
- `leave-decimal.test.ts`
- `leave-ledger-balance.test.ts`
- `leave-ledger-service.test.ts` (idempotent approve, pending ≠ consumption, recovery once, RBAC)
- `leave-approval-context.test.ts`
- `leave-approval-context-service.test.ts`
- `work-on-holiday-service.test.ts`
- `approval-workflow.test.ts`

## Quality checks (this delivery run)

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` (`ASTER_BUILD_WITHOUT_DB=1`) | PASS |

## Verified vs not verified

| Item | Status |
|------|--------|
| Focused tests / typecheck / lint / offline build | Verified PASS |
| Existing balances preserved via opening backfill (demo/tests) | Verified in tests |
| Duplicate approval consumption prevented | Verified in tests |
| Pending ≠ ledger consumption | Verified in tests |
| Recovery credit only after WOH confirmation | Verified in tests |
| Production `prisma migrate deploy` | **Not run** |
| Production backfill on live data | **Not verified** |
| Vercel / live deployment | **Not confirmed** |

## Known limitations

- No automatic monthly accruals, carryover/expiry jobs, or full entitlement admin UI (Phase 2+).
- `LeaveBalance` Float rows remain as a denormalized projection/cache; Decimal ledger is authoritative.
- Approve-time debit is a deliberate Phase 1 lifecycle change (previously no debit on approve).

## Next recommended phase

**Phase 2:** apply migration on hosted Postgres, verify live backfill matches current soldes, then design validated accrual/entitlement policies from `docs/HR_REQUIREMENTS.md` (no invented barèmes).
