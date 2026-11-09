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
| `ASTER_MODE` | manuel = `demo` | Mode démonstration (reset UI) | Production |
| `AUTH_SECRET` | manuel | Secret session Auth.js (identique build/runtime) | Production |
| `AUTH_URL` | manuel recommandé | URL HTTPS canonique (cookies / callbacks) | Production |
| `ASTER_CREDENTIALS_AUTH` | `1` / `0` | Login temporaire | Production |
| `ASTER_ENTRA_AUTH` | `0` jusqu’au handover | Active Entra si vars présentes | Production |
| `ASTER_SEED_PASSWORD` | manuel (seed only) | Hash des comptes seed | Seed one-shot |
| `ASTER_MIGRATE_ON_BUILD` | optionnel `1` | Force migrate hors Production | Uniquement avec DB dédiée |
| `ASTER_SKIP_MIGRATE` | optionnel `1` | Désactive migrate même en Production | Secours temporaire |
| `SUPABASE_URL` | intégration / manuel | URL projet Supabase **préférée** côté serveur (Storage) | Production |
| `NEXT_PUBLIC_SUPABASE_URL` | manuel / intégration | Fallback URL si `SUPABASE_URL` absente | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | manuel **secret** | Upload / signed URLs serveur | Production (jamais `NEXT_PUBLIC_`) |
| `ASTER_STORAGE_BUCKET` | optionnel | Doit rester `aster-private-docs` en Production | Production |
| `ASTER_ALLOW_MOCK_STORAGE` | optionnel `1` | Autorise le mock hors config Supabase | **Jamais** en démo board |

**Storage recrutement :**
1. Bucket **privé** `aster-private-docs` (`public=false`) — SQL : `docs/supabase/storage-aster-private-docs.sql`
2. **Aucune** policy Storage pour `anon` / `authenticated` (service role serveur uniquement)
3. Variables `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY` obligatoires en Production (sinon erreur explicite, pas de mock silencieux)
4. Le bucket doit exister **sur le même projet** que l’URL configurée (les erreurs incluent `projet=<ref> bucket=aster-private-docs`)
5. Vérifier : `npx tsx scripts/verify-storage-bucket.ts`
6. Détails : `docs/RECRUITMENT.md`

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

## Seed démo (one-shot Production, sans credentials locales)

Le seed CLI (`resetMutable: false`) crée les enregistrements manquants et **préserve** les lignes déjà présentes (`update: {}`) — aucun `DELETE` / `DROP` / `TRUNCATE`.

**Exécution recommandée** (utilise les `POSTGRES_*` déjà présents sur Vercel — pas de copie locale, pas d’API publique) :

1. Vercel → projet ASTER → **Settings → Environment Variables → Production**
2. Ajouter `ASTER_SEED_ON_BUILD` = `1`
3. **Deployments → … → Redeploy** le déploiement Production (ou pousser un commit sur `main`)
4. Dans les logs build, vérifier :
   - `ASTER demo seed one-shot`
   - `Seed ASTER terminé (idempotent).`
   - `OK emp-lea / Léa`, `OK emp-julien / Julien`, `OK emp-camille / Camille`
5. **Supprimer** `ASTER_SEED_ON_BUILD` (ou la passer à autre chose que `1`) pour les prochains deploys

Le flag est ignoré hors `VERCEL_ENV=production`. La pipeline migrate existante n’est pas modifiée (le seed s’ajoute après, en opt-in).

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
