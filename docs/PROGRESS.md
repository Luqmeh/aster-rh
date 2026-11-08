# ASTER — Progress Report

**Date:** 8 November 2026  
**Phase:** 8 — Enterprise authentication, role separation & Microsoft SSO readiness  
**Product:** ASTER — Human Resources, connected.  
**Context:** Board demo prototype with real auth boundaries; Entra SSO configurable by IT (not claimed live without tenant).

---

## Authentication architecture

- **Auth.js (next-auth v5)** — JWT sessions, HTTP-only cookies.
- **Providers** (independent, env-switched):
  - Credentials (temporary) — `ASTER_CREDENTIALS_AUTH` (default on).
  - Microsoft Entra ID OIDC — `ASTER_ENTRA_AUTH=1` + `AUTH_MICROSOFT_ENTRA_ID_*` (off until configured).
- **Application identity** — `UserAccount` (email, passwordHash?, provider, externalSubject?, role, employeeId, isActive).
- **AuthPort** — `session-auth` maps Auth.js → `AuthSession` + Employee via HR repository.
- Login UI: `/connexion` (no role selector). Logout in topbar.
- Middleware protects app routes; `/administration` = `admin_rh` only.

## Role & permission changes

| Change | Detail |
|--------|--------|
| Strict Manager ≠ RH | RH cannot approve `en_attente_manager`; only `en_attente_rh` |
| Navigation | Administration RH reserved to `admin_rh` |
| Server actions | `requireSession` / role checks; no client-trusted role |
| Demo UI removed | Banner, identity switcher, mobile role bar deleted |

See `docs/AUTHORIZATION_MATRIX.md`.

## Database migrations

- New migration `20261108180000_user_accounts` — `AuthProvider` enum + `UserAccount` (no DROP/TRUNCATE of existing tables).
- Seed creates Léa / Julien / Camille accounts; password hash only if `ASTER_SEED_PASSWORD` set.

## Files (high level)

**Created:** `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`, `src/app/connexion/*`, `src/components/auth/login-form.tsx`, `src/app/actions/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, auth helpers (`password`, `rate-limit`, `authorization`, `account-store`, `session-auth`, `test-session`), migration SQL, `docs/SSO_HANDOVER.md`, `docs/AUTHORIZATION_MATRIX.md`, this `PROGRESS.md`.

**Modified:** Prisma schema, container, leave/telework services & actions, approvals rules, navigation, layouts/topbar/parametres/administration, seed lifecycle, package.json, docs/README/AGENTS/DEPLOYMENT/ARCHITECTURE/INTEGRATIONS, `.env.example`.

**Deleted:** demo-auth cookie switcher, DemoBanner, RoleSwitcher, MobileRoleBar, DemoIdentitySelect; previous `PROGRESS.md`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `next-auth@beta` (v5) | Sessions / OIDC / credentials |
| `bcryptjs` (+ types) | Password hashing |

## Checks

| Check | Result |
|-------|--------|
| `npm test` | **128 passed**, 1 skipped |
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** |
| `npm run build` | **Pass** |
| Real Entra tenant E2E | **Not tested** (no tenant credentials) |

## Remaining security limitations

1. Login rate-limit is in-memory (not shared across Vercel instances) — replace with Redis/Upstash for production hardening.
2. Credentials auth remains available until IT sets `ASTER_CREDENTIALS_AUTH=0`.
3. `AUTH_SECRET` must be set to a strong value on Vercel (build placeholder is not for runtime).
4. Accounts/password seed require `ASTER_SEED_PASSWORD` + migrate `UserAccount` applied on Production.
5. Entra account linking still needs admin provisioning of `externalSubject` / email match.
6. Next.js 16 warns middleware → proxy rename (non-blocking).

## Microsoft SSO handover readiness

Code path + `docs/SSO_HANDOVER.md` checklist ready. **Not** production-grade SSO until IT configures tenant app registration, env vars, and disables credentials — then reviewed.

## Exact next recommended phase

1. Apply migration on Production (auto via `build:vercel` on next deploy).  
2. Set Vercel `AUTH_SECRET`, `ASTER_SEED_PASSWORD`, re-run one-shot seed (`ASTER_SEED_ON_BUILD=1` then remove).  
3. Validate login as Léa / Julien / Camille and approval separation.  
4. Begin Entra app registration using `docs/SSO_HANDOVER.md`.
