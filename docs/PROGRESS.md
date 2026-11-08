# ASTER — Progress Report

**Phase :** 9 — Employee Directory, Profiles & Definitive Role Hierarchy  
**Date :** 8 novembre 2026  
**Branche :** `main`

## Implemented functionality

- Central permission matrix in `src/domain/rules/permissions.ts` with reusable checks (`canApproveRequests`, `canBrowseDirectory`, `canManageEmployees`, `canViewAllRequests`, etc.).
- Definitive three-role hierarchy enforced in approvals, leave/telework services, server actions, middleware, navigation and calendars.
- Persistent employee directory (`/annuaire`) with search, department / team / status filters, empty state and profile links.
- Employee profiles (`/annuaire/[id]`) with full HR record management for Chef de projet and RH.
- Personal profile (`/profil`) with self-service edit of permitted fields (phone, site).
- HR can view leave and telework queues without approval buttons or server-side decide rights.
- Chef de projet can approve/reject globally and access all HR administration.

## Definitive role hierarchy

1. **Chef de projet** (`chef_de_projet`) — all HR permissions + all approval/rejection capabilities, global scope.
2. **Ressources humaines** (`admin_rh`) — directory, employee management, request visibility, no decisions.
3. **Collaborateur** (`collaborateur`) — own profile and self-service only.

French labels: Chef de projet / Ressources humaines / Collaborateur.

## Permission changes

- Removed lower-privilege Manager role from application roles (`DemoRole`).
- Approvals: only `chef_de_projet` via `assertCanDecideRequest` / `canApproveRequests`.
- RH: view-all on leave/telework; decide actions throw AuthError server-side.
- Directory: Chef de projet + RH only; collaborators redirected to `/profil`.
- Administration route: Chef de projet + RH.
- Calendar/dashboard: global people scope for Chef de projet and RH.

## Files and database changes

**Core**
- `src/domain/rules/permissions.ts` (+ tests)
- `src/domain/rules/approvals.ts` (+ tests)
- `src/domain/types/hr.ts` (`DemoRole`)
- `src/infrastructure/auth/authorization.ts`, `session-auth.ts`, `middleware.ts`
- `src/application/services/{leave,telework,dashboard,calendar,employee}-service.ts`
- `src/app/actions/{leave,telework,employee}.ts`
- `src/infrastructure/persistence/{hr-repository,demo-hr-repository,prisma-hr-repository}.ts` (`updateEmployee`, `includeInactive`)
- UI: `/annuaire`, `/annuaire/[id]`, `/profil`, `/conges`, `/teletravail`, `/administration`, `/tableau-de-bord`, `/calendrier`
- `src/lib/navigation.ts`, seed/demo accounts, docs matrix/guide/roadmap/architecture/HR requirements

**Database**
- Prisma enum migration `prisma/migrations/20261108193000_role_hierarchy_chef_de_projet/`
  - `manager` → `chef_de_projet` (no DROP/TRUNCATE of business data)
- Seed: Julien = Chef de projet, Camille = RH, Léa = Collaborateur

## Tests and results

```text
npm test
Test Files  23 passed (23)
Tests       137 passed | 1 skipped (138)
```

Coverage added/updated for permissions, approvals, approval workflows, employee directory/profiles, authorization routes.

## Typecheck / lint / build

```text
npm run typecheck  → OK
npm run lint       → OK
npm run build      → OK (Next.js 16.4.5 production build)
```

## Remaining issues

- Organizational “team” filter uses hierarchical `managerId` (no separate Team entity in schema).
- Create-employee UI not exposed yet (update/deactivate available); provisioning remains seed/admin controlled so Chef de projet cannot be self-assigned.
- Apply migration + reseed on deployed Postgres if not already migrated.

## Exact next recommended phase

**Phase 10 — Employee provisioning & org structure hardening**  
Add controlled employee creation / deactivation flows for Chef de projet & RH, optional Team entity if required by PKF org chart, and Entra ID account linking without changing the definitive role hierarchy.
