# ASTER — Déploiement et persistance PostgreSQL

Guide pour la démo board sur Vercel avec Prisma + projet Supabase **dédié ASTER**.

> Environnement de **démonstration** — pas un SI RH de production pour données confidentielles.

## Architecture de déploiement (audit)

| Élément | Comportement |
|---------|----------------|
| Framework | Next.js 16 App Router sur Vercel |
| Build local / CI offline | `npm run build` → `ASTER_BUILD_WITHOUT_DB=1 next build` (sans DB) |
| Build Vercel | `vercel.json` → `npm run build:vercel` → `scripts/vercel-build.ts` |
| Migrations | `prisma migrate deploy` **uniquement** si `VERCEL_ENV=production` (ou `ASTER_MIGRATE_ON_BUILD=1`) |
| Runtime app | Requêtes via `DATABASE_URL` ← `POSTGRES_PRISMA_URL` (poolée) |
| Migrations CLI | `DIRECT_URL` ← `POSTGRES_URL_NON_POOLING` (non poolée) |
| Serverless instances | **Ne migrent pas** — aucun hook dans les fonctions |
| Seed démo | **Hors pipeline** — commande contrôlée `npm run db:seed` |

Vercel n’offre pas de « release phase » séparée pour ce setup : le moment sûr et simple est la **machine de build Production**, avant que la nouvelle version ne reçoive du trafic. Un échec de migrate fait échouer le build → l’ancien déploiement reste en service.

## Variables d’environnement

| Variable Prisma | Source Vercel (intégration Supabase) | Rôle | Portée recommandée |
|-----------------|--------------------------------------|------|--------------------|
| `DATABASE_URL` | `POSTGRES_PRISMA_URL` | Requêtes applicatives poolées | Production (+ Preview seulement si base Preview **séparée**) |
| `DIRECT_URL` | `POSTGRES_URL_NON_POOLING` | `migrate deploy` | Idem |
| `ASTER_PERSISTENCE` | manuel = `prisma` | Force Prisma au runtime | Production |
| `ASTER_MODE` | manuel = `demo` | Mode démonstration | Production |
| `ASTER_MIGRATE_ON_BUILD` | optionnel `1` | Force migrate hors Production | Uniquement avec DB dédiée |
| `ASTER_SKIP_MIGRATE` | optionnel `1` | Désactive migrate même en Production | Secours temporaire |

**Cible des migrations automatiques : Production uniquement.**  
Les Preview qui partagent les `POSTGRES_*` de Production **ne migrent pas** (garde-fou). Ne branchez pas Preview sur la base board sans base séparée + `ASTER_MIGRATE_ON_BUILD=1` assumé.

Le schéma Prisma 6 n’accepte qu’un `env("…")` par champ ; le mapping est dans `database-env.ts` / `load-database-env.ts`.

## Pipeline Production (Phase 7b)

Sur chaque déploiement **Production** (`main` → Vercel) :

1. Install + `postinstall` → `prisma generate`
2. `build:vercel` :
   - charge l’env / mappe `POSTGRES_*`
   - si Production : `prisma generate` + `prisma migrate deploy` (verrou Prisma `_prisma_migrations` / advisory lock)
   - puis `ASTER_BUILD_WITHOUT_DB=1 next build`
3. Vercel active le nouveau déploiement seulement si le build réussit

**Interdit** contre la base board : `migrate dev`, `migrate reset`, `db push`.

## Seed démo (hors déploiement)

`npm run db:seed` utilise `resetMutable: false` (upserts idempotents sur les IDs seed).  
Ce n’est **pas** lancé par `build:vercel`, car les upserts réécrivent l’état des lignes seed et ne doivent pas s’exécuter à chaque deploy.

Déclenchement contrôlé (après premier migrate réussi) :

```bash
# Machine locale avec .env.local pointant vers le projet Supabase ASTER uniquement
npm run db:seed
```

Reset destructif des tables mutables : UI **Paramètres** (`ASTER_MODE=demo`) uniquement — jamais dans le pipeline.

## Développement local

Sans PostgreSQL :

```bash
ASTER_PERSISTENCE=memory npm run dev
npm run build   # offline OK
```

Avec PostgreSQL ASTER :

```bash
# .env.local : DATABASE_URL + DIRECT_URL (projet ASTER uniquement)
npm run db:migrate
npm run db:seed
ASTER_PERSISTENCE=prisma npm run dev
```

## Checklist Vercel

1. Intégration Supabase officielle → `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` (Production).
2. Ajouter `ASTER_PERSISTENCE=prisma` et `ASTER_MODE=demo` (Production).
3. Confirmer `vercel.json` `buildCommand` = `npm run build:vercel` (pas d’override dashboard contradictoire).
4. Pousser sur `main` → build Production → logs : `ASTER migrate deploy` puis Next build.
5. Une fois les tables créées : `npm run db:seed` une fois (contrôlé).
6. Parcours Léa → Julien + reload.

## Sécurité

- Jamais de secrets dans le dépôt ; pas d’echo des URLs.
- URLs DB uniquement serveur (jamais `NEXT_PUBLIC_*`).
- Projet Supabase **ASTER** uniquement — ne pas reconfigurer d’autres projets.
- Preview ne doit pas migrer la base Production partagée.

## Ce qui n’est pas encore validé

- Exécution réelle d’un `migrate deploy` réussi sur Supabase ASTER via un déploiement Production Vercel.
- Seed initial sur la base hébergée.
- Tests d’intégration Prisma (`ASTER_TEST_DATABASE_URL`).
