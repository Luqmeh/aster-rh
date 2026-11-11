# ASTER — Sécurité base & API Supabase

Guide des contrôles visant à empêcher l’exposition accidentelle de métadonnées ou de données RH via l’API Data (PostgREST) Supabase.

> Environnement de **démonstration** — pas un SI RH de production pour données confidentielles.

## Principes

1. L’application ASTER parle à PostgreSQL via **Prisma** (`DATABASE_URL` / rôle propriétaire ou migration), **pas** via la clé `anon` côté navigateur pour les tables métier.
2. Les rôles Data API `anon` et `authenticated` ne doivent **pas** avoir de privilèges inutiles sur les tables `public`.
3. Pas de policy RLS permissive (`USING (true)`) « pour faire taire » le Security Advisor.
4. Le Storage reste privé (`aster-private-docs`) — service role serveur uniquement (`docs/RECRUITMENT.md`, `docs/DEPLOYMENT.md`).

## Table `public._prisma_migrations`

| Élément | Décision |
|---------|----------|
| Nature | Métadonnées internes Prisma (historique migrate) — **pas** une table métier |
| Emplacement | Reste dans `public` (attendu par Prisma migrate) |
| Exposition API | Interdite |
| Correctif | Migration `20261111200000_lock_prisma_migrations_api_roles` |

### Privilèges modifiés (migration)

| Action | Cible | Effet |
|--------|-------|-------|
| `REVOKE ALL` | `anon` | Plus aucun SELECT/INSERT/UPDATE/DELETE/… via clé anon |
| `REVOKE ALL` | `authenticated` | Idem pour le rôle JWT authenticated |
| `REVOKE ALL` | `PUBLIC` | Coupe les grants par défaut éventuels |
| `ENABLE ROW LEVEL SECURITY` | table | Deny-by-default pour non-owners ; **aucune** policy créée |
| **Pas** de `FORCE ROW LEVEL SECURITY` | — | Le propriétaire / rôle Prisma conserve l’accès migrate |

Le rôle utilisé par `prisma migrate deploy` / `migrate status` (connexion `DIRECT_URL` / owner) **conserve** SELECT/INSERT/UPDATE nécessaires : owner bypass RLS, grants API retirés seulement.

### Vérification

Avec credentials du projet Supabase ASTER dédié :

```bash
npx tsx scripts/verify-prisma-migrations-grants.ts
# ou via le wrapper env :
# (après chargement DATABASE_URL + DIRECT_URL)
```

Le script échoue si :

- `anon` / `authenticated` / `PUBLIC` ont encore un grant ;
- RLS est OFF ;
- `FORCE ROW LEVEL SECURITY` est ON (casse migrate) ;
- le rôle Prisma ne peut plus lire la table.

Inspection SQL manuelle (avant / après) :

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = '_prisma_migrations'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC');

SELECT c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations';
```

Contrôle API (doit échouer / 0 row / permission denied) : requête PostgREST sur `/rest/v1/_prisma_migrations` avec la clé **anon** — ne jamais utiliser la service role pour ce test négatif.

## Pipeline migrations

Inchangé : `scripts/vercel-build.ts` → `prisma migrate deploy` en Production uniquement (`docs/DEPLOYMENT.md`).  
Cette migration additive s’applique au prochain deploy Production.

## Risques résiduels

- Tant que la migration n’est pas déployée, l’Advisor peut encore signaler `rls_disabled_in_public`.
- D’autres tables `public` métier peuvent encore avoir des grants API historiques — hors périmètre de ce correctif ciblé `_prisma_migrations`.
- Un changement futur des *default privileges* Supabase pourrait re-créer des grants sur **nouvelles** tables ; à surveiller séparément.

## Prochaine étape recommandée

Auditer les grants `anon`/`authenticated` sur **toutes** les tables métier `public` ASTER et appliquer le même modèle (revoke + RLS deny-by-default sans policies permissives) table par table, sans toucher au pipeline Vercel.
