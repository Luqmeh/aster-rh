# ASTER — Progress Report

**Date:** 8 November 2026  
**Phase:** 8b — Fix Auth.js / Vercel redirect loop  
**Product:** ASTER — Human Resources, connected.  
**Parent:** `093e33cde2872b7c55644fa5c4451dfa34d44130`

---

## Root cause

On Vercel (HTTPS), Auth.js sets the session cookie as `__Secure-authjs.session-token`.

Middleware used `getToken({ secret })` **without** aligning secure-cookie detection (and without `AUTH_URL`). It looked up the **non-secure** cookie name and always got `null`.

Meanwhile `/connexion` called `auth()`, which **did** read the secure cookie:

1. Login sets `__Secure-…` cookie → redirect `/tableau-de-bord`
2. Middleware: no token → redirect `/connexion`
3. `/connexion`: session present → redirect `/tableau-de-bord`
4. Repeat → `ERR_TOO_MANY_REDIRECTS` (also on Visit while the cookie remains)

RBAC and login credentials were not the cause.

## Fix

- Middleware uses edge-safe `NextAuth(authConfig).auth` (same cookie / secure policy as Auth.js).
- `useSecureCookies` forced on Vercel/production in `auth.config.ts`.
- JWT/session claim mapping shared in `auth.config.ts` for middleware role checks.
- App layout: if JWT exists but applicative session cannot be resolved → `signOut` (avoids a second loop class).
- Docs / `.env.example`: recommend `AUTH_URL` (canonical HTTPS).

## Files

- Modified: `src/middleware.ts`, `src/auth.config.ts`, `src/auth.ts`, `src/app/(app)/layout.tsx`, `src/app/connexion/page.tsx`, `.env.example`, `docs/DEPLOYMENT.md`
- Deleted then recreated: `docs/PROGRESS.md`

## Checks

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| Focused Vitest (auth + approvals) | 19 passed |
| `npm run build` | Pass |

## Vercel env — action required?

| Variable | Action |
|----------|--------|
| `AUTH_SECRET` | **Required** — must be set at runtime (same value always). |
| `AUTH_URL` | **Recommended** — canonical HTTPS URL of the deployment (e.g. `https://<project>.vercel.app`). Helps cookie/host consistency. |
| Passwords / seed | **No change** for this fix. |

After deploy: clear site cookies for the deployment host once (or private window), then login again.

## Exact next step

Redeploy Production with this commit, set `AUTH_URL` if missing, clear cookies, verify `/connexion` → dashboard without redirect loop.
