# ASTER — Progress report

Generated: 2026-11-10 (Complete project refinement & production-readiness pass)  
Branch: `main`  
HEAD before this commit: `1d21647`  
Deployment status: **not claimed as production-ready** — local checks passed; live Vercel smoke not re-verified in this cycle.

## Audit summary

Full audit documented in `docs/AUDIT_REFINEMENT.md`. Highest risks were JWT role freeze after demotion, open redirect on login callback, HR `isActive` bypass of lifecycle, interviewer visibility of `hrNotes`, sticky unread notifications, and misleading documents/recruitment copy.

## Implemented changes

### Security / authorization
- `getSession()` always reloads `UserAccount.role` + `isActive` (JWT no longer authoritative for privileges).
- Login `callbackUrl` sanitized against open redirects (`sanitizeCallbackUrl`).
- HR employee patch no longer accepts `isActive` / lifecycle shortcuts.
- Recruitment `hrNotes` redacted for assigned interviewers.
- Vercel mock storage requires `ASTER_ALLOW_MOCK_STORAGE_CONFIRM=1`.

### Functional / UX
- Notifications: mark-as-read on `/notifications` open.
- Nav: « Recrutement », « Congés (CP / RTT) », longest-match topbar titles.
- Profil / dashboard documents copy clarified (PeopleDoc / demandes).
- FR tagline; admin-only auth tech card on paramètres; mobile « Menu ».
- App `(app)/loading.tsx` + `error.tsx`.

### Documentation
- `AUDIT_REFINEMENT.md`, AUTHORIZATION_MATRIX, DEPLOYMENT, ROADMAP, `.env.example`, fresh PROGRESS.

## Files changed (principal)

- `src/infrastructure/auth/session-auth.ts`
- `src/lib/safe-callback-url.ts` (+ tests)
- `src/app/actions/auth.ts`, `notifications.ts`
- `src/application/services/employee-service.ts`, `recruitment-service.ts`
- Persistence: `markNotificationsRead` (demo + prisma)
- UI: notifications, profil, dashboard, nav, sidebar, layout, parametres, mobile-nav, conges, entretiens detail, loading/error
- Storage: `supabase-storage.ts` (+ tests)
- Docs + `.env.example`

## Dependencies

None added or removed.

## Tests executed

```
vitest run permissions, recruitment, employee, work-absence, reporting,
  safe-callback-url, navigation, supabase-storage
Test Files  8 passed
Tests       39 passed (+ storage confirm case)
```

Also previously green suites for absences/reporting not re-broken.

## Typecheck / lint / build

| Check | Result |
|-------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `ASTER_BUILD_WITHOUT_DB=1 npm run build` | pass |

## Database migrations

No new migration in this refinement batch. Existing `20261109040000_work_absences` remains the latest pending Production apply if not yet deployed.

## Security findings addressed

- P1 JWT role freeze
- P2 open redirect
- P2 HR isActive bypass
- P2 hrNotes interviewer leak
- P2/P3 mock storage on Vercel

## Known issues / remaining limitations

- Special-leave numeric caps still hypothese / HR review (guide p.46).
- Planned modules remain non-operational (temps, frais, rémunération, formation, mobilité) — correctly marked.
- Login rate limit still process-local.
- Temporary password still returned to browser on onboard (demo).
- Entra SSO not production-activated.
- No automatic payroll / RTT adjustments.
- Live Production E2E (absence medical isolation, role demotion mid-session) not verified in this cycle.
- `docs/git ssh.txt` untracked — do not commit.

## Manual verification still required

1. Vercel Production deploy after push; confirm migrate for work absences if pending.
2. Demote a Chef account → confirm elevated actions fail on next request (same browser session).
3. Collaborateur interviewer cannot see Notes RH; Chef cannot download absence certificates.
4. Open `/notifications` → badge clears after refresh.

## Exact next recommended step

After Vercel deploy: smoke the three demo accounts on `aster-rh.vercel.app` for session demotion, notifications mark-read, and absence medical isolation; then decide whether to tackle Entra SSO or guide p.46 entitlement transcription.
