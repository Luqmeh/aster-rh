# ASTER — Progress Report

**Phase :** 10b — Supabase Storage CV hardening (`aster-private-docs`)  
**Date :** 8 novembre 2026  
**Branche :** `main`

## Verification summary

| Check | Result |
|-------|--------|
| Bucket name exact `aster-private-docs` | Enforced in code (default + Production reject of other names) |
| Private / no public URLs | Signed URLs only; reject `/object/public/` if ever returned |
| Upload HR(+Chef inherit) server-side | `uploadCv` → `canManageRecruitment` + session |
| Download HR / Chef / assigned interviewer | `requireCandidateAccess` then signed URL |
| Path cannot steal another CV | Key must start with `recruitment/{candidateId}/` |
| Production mock fallback | **Removed** — explicit error unless build offline / `ASTER_ALLOW_MOCK_STORAGE=1` |
| Storage RLS policies | Cannot query live Supabase from this agent (MCP auth unavailable). SQL hardening script added; expected config = **private bucket + no anon/authenticated policies** (service role only). |

## Implemented changes

- Fail-closed Production storage when Supabase env missing.
- Clamp signed URL TTL to ≤ 120s; reject public object URLs.
- CV key ownership assertion before download.
- SQL checklist `docs/supabase/storage-aster-private-docs.sql`.
- Verify script `scripts/verify-storage-bucket.ts`.
- Docs: `RECRUITMENT.md`, `DEPLOYMENT.md`, `.env.example`.

## Files changed

- `src/infrastructure/storage/supabase-storage.ts` (+ tests)
- `src/domain/rules/recruitment.ts` (+ storage key helpers/tests)
- `src/application/services/recruitment-service.ts` (+ ownership test)
- `scripts/verify-storage-bucket.ts`
- `docs/supabase/storage-aster-private-docs.sql`
- `docs/RECRUITMENT.md`, `docs/DEPLOYMENT.md`, `.env.example`, `docs/PROGRESS.md`

## Dependencies

- None new (existing `@supabase/supabase-js`).

## Focused test results

```text
vitest: supabase-storage / recruitment-storage / recruitment-service
Test Files  3 passed
Tests       10 passed
```

## Typecheck / lint / build

```text
npm run typecheck → OK
npm run lint      → OK
npm run build     → OK
```

## Known issues / operator actions

1. Authenticate Supabase MCP in Cursor Desktop (or run SQL + verify script) to confirm live bucket `public=false` and absence of permissive Storage policies.
2. Set Production env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Run `docs/supabase/storage-aster-private-docs.sql` if the bucket was created without MIME/size limits or with accidental public policies.
4. Run `npx tsx scripts/verify-storage-bucket.ts` with Production secrets.

**Bucket readiness for real CV uploads:** code is ready. Live readiness depends on Production env + private bucket confirmation (step 1–4). Creating the bucket alone does **not** prove RLS — default private + no policies is correct for service-role-only access.

## Exact next recommended step

Run `scripts/verify-storage-bucket.ts` against the Production Supabase project, apply `storage-aster-private-docs.sql` if needed, then upload one test CV from an RH session and open it as Chef de projet / assigned interviewer.
