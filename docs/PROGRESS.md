# ASTER — Rapport d'avancement

**Date :** 11 novembre 2026  
**Phase :** Correctif sécurité — exposition métadonnées `public._prisma_migrations`

## Fonctionnalités / correctifs livrés

- Investigation du finding Supabase Security Advisor `rls_disabled_in_public` sur `public._prisma_migrations` (table interne Prisma, hors métier RH).
- Décision : **conserver** la table dans `public` (architecture Prisma migrate) et **révoquer** les privilèges Data API plutôt que déplacer/renommer.
- Migration additive `20261111200000_lock_prisma_migrations_api_roles` :
  - `REVOKE ALL` depuis `anon`, `authenticated`, `PUBLIC`
  - `ENABLE ROW LEVEL SECURITY` **sans** policy et **sans** `FORCE` (owner / rôle migrate intact)
- Script de vérification runtime : `scripts/verify-prisma-migrations-grants.ts`
- Documentation : `docs/SECURITY.md` (+ renvoi dans `docs/DEPLOYMENT.md`)
- Pipeline Vercel / `migrate deploy` : **inchangé**

## Fichiers modifiés

- `prisma/migrations/20261111200000_lock_prisma_migrations_api_roles/migration.sql`
- `scripts/verify-prisma-migrations-grants.ts`
- `scripts/verify-prisma-migrations-grants.test.ts`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/PROGRESS.md` (remplacé)

## Changements base de données

| Privilège / réglage | Avant (typique Supabase public) | Après (migration) |
|---------------------|----------------------------------|-------------------|
| Grants `anon` | Souvent ALL / SELECT | **Aucun** |
| Grants `authenticated` | Souvent ALL / SELECT | **Aucun** |
| Grants `PUBLIC` | Possible selon défauts | **Aucun** |
| RLS | OFF (finding Advisor) | **ON**, 0 policy |
| `FORCE ROW LEVEL SECURITY` | OFF | **OFF** (préserve Prisma) |
| Accès rôle migrate / owner | OK | **OK** (bypass RLS owner) |

Aucune table métier, aucun ledger, aucun seed/reset Production.

## Tests et validation

| Contrôle | Résultat |
|----------|----------|
| Tests migration SQL (Vitest) | 3 passed |
| `npm test` (suite) | OK (après correctif) |
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK |
| Inspection grants live Production | **Non exécutée ici** — `vercel env pull` masque les secrets DB ; pas de `DATABASE_URL` locale ; MCP Supabase non authentifié dans cet environnement |
| `prisma migrate status` live | À confirmer au prochain deploy Production (migration additive standard) |

Commande de validation post-deploy (avec credentials projet) :

```bash
npx tsx scripts/verify-prisma-migrations-grants.ts
```

## Problèmes connus / limites

- Le Security Advisor restera rouge **jusqu’à** application de la migration sur la base board (deploy Production).
- Impossible de prouver les grants avant/après contre Production depuis cet agent faute de secret DB exportable.
- D’autres tables `public` métier peuvent encore porter des grants API historiques (hors scope de ce ticket).

## Travail restant

- Appliquer la migration via le pipeline Production existant.
- Exécuter `verify-prisma-migrations-grants.ts` et re-lancer l’Advisor Supabase.
- Auditer grants API sur les tables métier ASTER.

## Prochaine étape exacte

Déployer `main` en Production (migrate deploy automatique), puis exécuter `npx tsx scripts/verify-prisma-migrations-grants.ts` contre la base board et confirmer la disparition du finding `rls_disabled_in_public` pour `_prisma_migrations`.
