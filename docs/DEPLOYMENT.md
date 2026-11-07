# ASTER — Déploiement et persistance PostgreSQL

Guide pour préparer la démo board sur Vercel avec persistance Prisma/Supabase.

> Environnement de **démonstration** — pas un SI RH de production pour données confidentielles.

## Prérequis

1. Projet Supabase (ou PostgreSQL compatible) **dédié à ASTER**.
2. Compte Vercel pour l’application Next.js.
3. Variables d’environnement (jamais committer les secrets).

## Variables requises (runtime hébergé)

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | URL poolée (Supabase pooler / PgBouncer) pour le runtime |
| `DIRECT_URL` | URL directe pour `prisma migrate` |
| `ASTER_PERSISTENCE` | `prisma` (recommandé en hébergé) |
| `ASTER_MODE` | `demo` |

Optionnel : `ASTER_ALLOW_MEMORY=1` uniquement en secours local — **interdit** pour la démo board.

## Checklist base de données

1. Créer un projet PostgreSQL **ASTER** (ne pas réutiliser une autre base métier).
2. Copier `.env.example` → `.env.local` et renseigner `DATABASE_URL` + `DIRECT_URL` (placeholders remplacés, sans commit).
3. Générer le client : `npm run db:generate`
4. Appliquer les migrations : `npm run db:migrate` (`prisma migrate deploy`)
5. Seed idempotent : `npm run db:seed`
6. Vérifier Studio : `npm run db:studio` (local)

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
2. Définir les variables d’environnement listées ci-dessus (Production + Preview si besoin).
3. Build command : `npm run build` (déjà `ASTER_BUILD_WITHOUT_DB=1` pour le build offline).
4. Après premier deploy réussi **avec** `DATABASE_URL` : exécuter migrations + seed via machine locale / CI pointant vers la même base ASTER :
   - `npm run db:migrate`
   - `npm run db:seed`
5. Contrôler le parcours Léa → Julien (congés + télétravail) puis redémarrer / recharger : les données doivent rester.

## Ce qui n’est pas encore validé

- Connexion réelle à une base ASTER (aucune credential n’était présente dans cet environnement au moment de la Phase 6).
- Déploiement Vercel effectif.
- Tests d’intégration Prisma (nécessitent `ASTER_TEST_DATABASE_URL` isolée).

## Reset démo

Dans l’UI **Paramètres** (uniquement si `ASTER_MODE=demo`) : réinitialise les tables ASTER seedées (congés, télétravail, notifications, documents) puis ré-applique le seed. Ne constitue **pas** un drop de base général.
