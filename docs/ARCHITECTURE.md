# Architecture ASTER

## Vue d’ensemble

Architecture **modulaire et orientée domaine**, avec ports/adaptateurs remplaçables.

```
src/
  app/                    # Routes Next.js (présentation)
  components/             # UI réutilisable + modules
  application/services/   # Cas d’usage (orchestration)
  domain/
    types/                # Modèle métier
    rules/                # Règles pures (testables)
  infrastructure/         # Adaptateurs (auth, persistence, email, storage)
  data/                   # Seed de démonstration
  lib/                    # Utilitaires
prisma/                   # Schéma PostgreSQL cible (Supabase)
```

## Couches

1. **Présentation** — pages App Router, composants React, server actions minces.
2. **Application** — services (`leave-service`, `telework-service`, `employee-provisioning-service`, `recruitment-service`, `document-request-service`, …).
3. **Domaine** — types + règles (congés, télétravail, cycle de vie, recrutement, demandes documentaires, validations) sans I/O.
4. **Infrastructure** — implémentations des ports.

## Ports principaux

| Port | Interface | Adaptateur actuel |
|------|-----------|-------------------|
| Auth / identité | `AuthPort` | Auth.js (`session-auth`) — credentials temporaires et/ou Microsoft Entra ID |
| Persistence RH | `HrRepository` | `demo-hr-repository` (mémoire) **ou** `prisma-hr-repository` (PostgreSQL) |
| Comptes applicatifs | `UserAccount` | Provisioning RH/Chef + audit `RoleChangeAudit` (pas d’auto-inscription privilégiée) |
| E-mail | `EmailPort` | `mock-email` |
| Stockage docs | `DocumentStoragePort` | Supabase Storage privé (`aster-private-docs`) si configuré, sinon `mock-storage` (interdit en Production) |

Namespaces Storage : `recruitment/{candidateId}/…` (CV) et `employee-documents/{employeeId}/{requestId}/…` (demandes documentaires) — ownership serveur, URL signées courtes.

Jours fériés : dataset versionné `src/data/morocco-holidays.ts` + overrides RH (`HolidayOverride`). Travail férié : `WorkOnHolidayRequest` + ledger `RecoveryCreditLedger` (1 h confirmée = 1 h, conversion jours via `standardDailyHours`).

Composition : `src/infrastructure/container.ts`.

## Authentification (Phase 8)

- Login `/connexion` — pas de sélecteur de rôle côté client.
- Sessions HTTP-only via Auth.js ; autorisation serveur (`authorization.ts` + règles domaine).
- Hiérarchie définitive : Chef de projet > Ressources humaines > Collaborateur (voir `docs/AUTHORIZATION_MATRIX.md`).
- SSO Entra : prêt à configurer (`docs/SSO_HANDOVER.md`) — désactiver credentials avec `ASTER_CREDENTIALS_AUTH=0`.
- Données RH seed : `src/data/demo-seed.ts` + comptes `UserAccount` (mot de passe via `ASTER_SEED_PASSWORD`).

## Persistance (Phase 6)

1. Provisionner un PostgreSQL **dédié ASTER** (Supabase recommandé).
2. Renseigner `DATABASE_URL` (pooler) + `DIRECT_URL` (migrations), ou sur Vercel laisser `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING` (mapping auto) — voir `.env.example` et `docs/DEPLOYMENT.md`.
3. Local : `npm run db:migrate` puis `npm run db:seed` (contrôlé). Production Vercel : `migrate deploy` dans `build:vercel` (Production only) ; seed **hors** pipeline.
4. Le container (`src/infrastructure/container.ts`) branche `prismaHrRepository` lorsque `ASTER_PERSISTENCE=prisma` ou qu’une `DATABASE_URL` / `POSTGRES_PRISMA_URL` est définie.
5. En production/Vercel, la mémoire est **refusée** (sauf secours explicite `ASTER_ALLOW_MEMORY=1`).
6. Le calendrier RH reste **dérivé** des congés / télétravail (pas de table d’événements dupliquée).

Le build local (`npm run build`) reste offline ; le build Vercel Production migre puis compile ; le **runtime** hébergé exige PostgreSQL pour la démo durable.

## Auth future (Entra ID)

Remplacer `demoAuth` par un adaptateur OIDC Entra sans changer les pages, en respectant le port `AuthPort`. Voir `docs/INTEGRATIONS.md`.

## Frontières intentionalement absentes

- Pas d’accès Outlook / Graph réel
- Pas de SSO productif
- Pas de secrets entreprise
- Pas de logos officiels confidentiels
