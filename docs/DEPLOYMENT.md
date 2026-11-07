# ASTER — Déploiement et persistance PostgreSQL

Guide pour préparer la démo board sur Vercel avec persistance Prisma/Supabase.

> Environnement de **démonstration** — pas un SI RH de production pour données confidentielles.

## Prérequis

1. Projet Supabase (ou PostgreSQL compatible) **dédié à ASTER**.
2. Compte Vercel pour l’application Next.js.
3. Variables d’environnement (jamais committer les secrets).

## Variables requises (runtime hébergé)

| Variable Prisma (schéma) | Source Vercel (intégration Supabase) | Rôle |
|--------------------------|--------------------------------------|------|
| `DATABASE_URL` | `POSTGRES_PRISMA_URL` (si `DATABASE_URL` absent) | URL poolée — runtime / requêtes applicatives |
| `DIRECT_URL` | `POSTGRES_URL_NON_POOLING` (si `DIRECT_URL` absent) | URL directe — `prisma migrate` |
| `ASTER_PERSISTENCE` | *(manuel)* `prisma` recommandé | Force le mode Prisma |
| `ASTER_MODE` | *(manuel)* `demo` | Mode démonstration |

Le schéma Prisma 6 n’accepte qu’un `env("…")` par champ. ASTER conserve `DATABASE_URL` / `DIRECT_URL` et applique le mapping via `database-env.ts` (runtime) et `scripts/with-prisma-env.ts` (CLI migrate/studio). **Pas besoin de dupliquer** les credentials Supabase dans Vercel.

Optionnel : `ASTER_ALLOW_MEMORY=1` uniquement en secours local — **interdit** pour la démo board.

## Checklist base de données

1. Créer un projet PostgreSQL **ASTER** (ne pas réutiliser une autre base métier).
2. **Local** : copier `.env.example` → `.env.local` et renseigner `DATABASE_URL` + `DIRECT_URL`.
3. **Vercel** : connecter le projet via l’intégration Supabase officielle (`POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` générés automatiquement). Définir aussi `ASTER_PERSISTENCE=prisma` et `ASTER_MODE=demo`.
4. Générer le client : `npm run db:generate`
5. Appliquer les migrations : `npm run db:migrate` (`prisma migrate deploy` via mapping env)
6. Seed idempotent : `npm run db:seed`
7. Vérifier Studio : `npm run db:studio` (local)

## Développement local

Sans PostgreSQL :

```bash
ASTER_PERSISTENCE=memory npm run dev
```

Avec PostgreSQL :

```bash
# .env.local avec DATABASE_URL + DIRECT_URL
ASTER_PERSISTENCE=prisma npm run db:migrate
npm run db:seed
npm run dev
```

## Vercel (préparation — ne pas déployer avant validation DB)

1. Relier le dépôt Git.
2. Intégration Supabase : variables `POSTGRES_*` générées automatiquement.
3. Ajouter `ASTER_PERSISTENCE=prisma` et `ASTER_MODE=demo` (Production + Preview si besoin).
4. Build command : `npm run build` (déjà `ASTER_BUILD_WITHOUT_DB=1` pour le build offline).
5. Après premier deploy réussi avec les URLs DB : exécuter migrations + seed via machine locale / CI pointant vers la même base ASTER (le mapping lit aussi `POSTGRES_*` si exportées) :
   - `npm run db:migrate`
   - `npm run db:seed`
6. Contrôler le parcours Léa → Julien (congés + télétravail) puis redémarrer / recharger : les données doivent rester.

## Ce qui n’est pas encore validé

- Connexion réelle à une base ASTER depuis cet environnement d’agent.
- Déploiement Vercel effectif après mapping.
- Tests d’intégration Prisma (nécessitent `ASTER_TEST_DATABASE_URL` isolée).

## Reset démo

Dans l’UI **Paramètres** (uniquement si `ASTER_MODE=demo`) : réinitialise les tables ASTER seedées (congés, télétravail, notifications, documents) puis ré-applique le seed. Ne constitue **pas** un drop de base général.
