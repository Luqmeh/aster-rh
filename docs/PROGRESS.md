# ASTER — Progress Report

**Phase :** 10 — Employee Lifecycle, Account Provisioning & Recruitment Interviews  
**Date :** 8 novembre 2026  
**Branche :** `main`

## Part A — completed functionality

- Employee onboarding (`/annuaire/nouveau`) with validation (id, email, duplicates).
- Secure `UserAccount` provisioning (credentials + temporary password via e-mail mock).
- Role assignment rules: RH → Collaborateur only; Chef de projet → all roles.
- Safeguard against removing the last Chef de projet access.
- Lifecycle statuses: `actif` / `inactif` / `parti` with confirmation UI.
- Deactivation / departure disables `UserAccount.isActive` (login blocked) while preserving historical leave/telework/notifications.
- `RoleChangeAudit` history (target, previous/new role, actor, timestamp).

## Part B — completed functionality

- Recruitment candidate model (external, no auto Employee).
- HR create/edit draft, CV upload, notes, submit for review.
- Chef de projet approve/reject (server-enforced; RH blocked).
- Interviewer assignment with explicit **Appliquer**.
- Interview history / pending review views under `/entretiens`.
- Assigned collaborateur sees only their assignments; CV via short-lived signed URL / mock private URL.
- Events + notifications for submission, decision, assignment.

## Database migrations

`prisma/migrations/20261108200000_employee_lifecycle_and_recruitment/`

- `EmploymentStatus` + employee departure fields
- `RoleChangeAudit`
- `RecruitmentCandidate` + `RecruitmentEvent`
- No DROP/TRUNCATE of business data; existing `isActive` mapped to `employmentStatus`

## Files changed (high level)

- Domain: `permissions`, `lifecycle`, `role-assignment`, `recruitment`, `hr` types
- Services: `employee-provisioning-service`, `recruitment-service` (+ tests)
- Persistence: schema, repos, mappers, demo-store
- Auth: `account-store` create/update
- Storage: `DocumentStoragePort` + Supabase adapter + mock
- UI: annuaire onboarding/lifecycle, `/entretiens/*`
- Docs: README, ARCHITECTURE, DEPLOYMENT, AUTHORIZATION_MATRIX, RECRUITMENT

## Dependencies

- Added: `@supabase/supabase-js@2` (Storage signed URLs / private uploads)

## Test results

```text
npm test
Test Files  26 passed (26)
Tests       149 passed | 1 skipped (150)
```

## Typecheck / lint / build

```text
npm run typecheck → OK
npm run lint      → OK
npm run build     → OK
```

## Storage configuration requirements

1. Create private Supabase bucket `aster-private-docs` (or set `ASTER_STORAGE_BUCKET`).
2. Set `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server only).
3. Without these vars, CV storage falls back to in-memory mock (dev/demo).

## Remaining limitations

- Interview “planifié / terminé” statuses exist but scheduling UI is minimal (assignment is the main path).
- Chef notifications on submit rely on account role lookup (+ seed Julien fallback in memory mode).
- No bulk import / Entra auto-provisioning for new hires beyond credentials accounts.
- Apply Production migrate via existing Vercel pipeline before relying on new tables.

## Exact next recommended implementation phase

**Phase 11 — Interview scheduling & outcome capture**  
Planify interview slots, capture interviewer compte rendu, mark `entretien_termine`, and optional conversion path from approved candidate → employee onboarding without hierarchy changes.
