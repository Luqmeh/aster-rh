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
2. **Application** — services (`leave-service`, `telework-service`, `dashboard-service`).
3. **Domaine** — types + règles (congés, télétravail, validations) sans I/O.
4. **Infrastructure** — implémentations des ports.

## Ports principaux

| Port | Interface | Adaptateur actuel |
|------|-----------|-------------------|
| Auth / identité | `AuthPort` | `demo-auth` (cookie + identités fictives) |
| Persistence RH | `HrRepository` | `demo-hr-repository` (mémoire) **ou** `prisma-hr-repository` (PostgreSQL) |
| E-mail | `EmailPort` | `mock-email` |
| Stockage docs | `DocumentStoragePort` | `mock-storage` |

Composition : `src/infrastructure/container.ts`.

## Mode démonstration

- Activé par défaut (aucune credential requise).
- Trois rôles : Collaborateur, Manager, Administrateur RH.
- Bandeau permanent + switcher d’identités.
- Données seedées dans `src/data/demo-seed.ts`.

## Persistance (Phase 6)

1. Provisionner un PostgreSQL **dédié ASTER** (Supabase recommandé).
2. Renseigner `DATABASE_URL` (pooler) + `DIRECT_URL` (migrations), ou sur Vercel laisser `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING` (mapping auto) — voir `.env.example` et `docs/DEPLOYMENT.md`.
3. `npm run db:migrate` puis `npm run db:seed`.
4. Le container (`src/infrastructure/container.ts`) branche `prismaHrRepository` lorsque `ASTER_PERSISTENCE=prisma` ou qu’une `DATABASE_URL` est définie.
5. En production/Vercel, la mémoire est **refusée** (sauf secours explicite `ASTER_ALLOW_MEMORY=1`).
6. Le calendrier RH reste **dérivé** des congés / télétravail (pas de table d’événements dupliquée).

Le build Vercel (`ASTER_BUILD_WITHOUT_DB=1`) reste possible sans base ; le **runtime** hébergé exige PostgreSQL pour la démo durable.

## Auth future (Entra ID)

Remplacer `demoAuth` par un adaptateur OIDC Entra sans changer les pages, en respectant le port `AuthPort`. Voir `docs/INTEGRATIONS.md`.

## Frontières intentionalement absentes

- Pas d’accès Outlook / Graph réel
- Pas de SSO productif
- Pas de secrets entreprise
- Pas de logos officiels confidentiels
