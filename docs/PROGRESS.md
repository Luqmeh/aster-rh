# ASTER — Progress report

**Date :** 2026-11-09  
**Focus :** Production CV upload — `Échec upload stockage : Bucket not found`  
**Statut :** Correctif code poussé — **alignement projet Supabase à confirmer en Production**

## Cause

### Ce que fait le code

- Bucket demandé partout (upload / signed URL / delete) : **`aster-private-docs`** (`ASTER_PRIVATE_DOCS_BUCKET`).
- `ASTER_STORAGE_BUCKET` **non défini** en Production Vercel → défaut `aster-private-docs` (pas un mauvais nom dans le code).
- Auth Storage fonctionne assez pour joindre l’API → l’erreur « Bucket not found » signifie : **sur le projet Supabase pointé par l’URL/clé serveur, ce bucket n’existe pas**.

### Config Production (sans secrets)

| Variable | État |
|----------|------|
| `ASTER_STORAGE_BUCKET` | unset (défaut OK) |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | présentes (marquées Sensitive — valeur non lisible via CLI pull) |
| `SUPABASE_SERVICE_ROLE_KEY` | présente |
| `ASTER_ALLOW_MOCK_STORAGE` | unset |

**Référence projet :** non extractible depuis l’agent (env Sensitive / non déchiffrable). À lire dans le dashboard Vercel (URL) ou dans les logs runtime après ce déploiement (`projet=<ref>`).

**Hypothèse la plus probable :** le bucket a été créé sur un projet Supabase **différent** de celui configuré dans Vercel (ou seule `NEXT_PUBLIC_…` était lue alors que `SUPABASE_URL` pointe ailleurs). Ce n’est **pas** un bucket public manquant ni un mock Production.

## Changements code

1. **Préférence URL serveur** : `SUPABASE_URL` puis `NEXT_PUBLIC_SUPABASE_URL` (alignement Postgres/intégration).
2. **Fallback clé** : `SUPABASE_SERVICE_ROLE_KEY` puis `SUPABASE_SECRET_KEY`.
3. **Diagnostics sûrs** : `projet=<ref> bucket=aster-private-docs urlSource=…` dans logs + messages d’erreur (jamais de credentials).
4. **Vérification bucket** avant upload/sign : `listBuckets` → message FR explicite + liste des buckets visibles si absent.
5. Script `verify-storage-bucket.ts` + docs/env example alignés.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `src/infrastructure/storage/supabase-storage.ts` | Préférence URL, diagnostics, assert bucket |
| `src/infrastructure/storage/supabase-storage.test.ts` | Régressions ref / priorité URL / secret fallback |
| `scripts/verify-storage-bucket.ts` | Diagnostic CLI |
| `.env.example` | `SUPABASE_URL` documenté |
| `docs/DEPLOYMENT.md` | Variables Storage |
| `docs/PROGRESS.md` | Rapport frais |

## Dépendances

Aucune nouvelle dépendance npm.

## Tests

```
npx vitest run src/infrastructure/storage/supabase-storage.test.ts \
  src/infrastructure/container-storage-lazy.test.ts \
  src/app/actions/recruitment-cv-upload.test.ts
→ 15 passed
```

## Typecheck / lint / build

| Check | Résultat |
|-------|----------|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK |

## Ce qui n’a pas changé

- Bucket cible toujours `aster-private-docs` (privé)
- Pas de mock Storage en Production
- Pas d’affaiblissement auth / pas de bucket public
- Pas de création automatique de bucket

## Issues restantes

- **Confirm project match** : après déploiement, l’erreur enrichie (ou les logs `[aster-storage]`) indiquera `projet=<ref>`. Comparer avec le projet où le bucket a été créé dans le dashboard Supabase.
- Si les refs diffèrent → **changement d’env Vercel** (pas seulement redeploy) : aligner `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sur le projet qui contient `aster-private-docs`, **ou** créer le bucket sur le projet déjà configuré (manuellement — pas via l’app).

## Prochaine étape exacte

1. Attendre le déploiement de ce commit sur `aster-rh.vercel.app`.
2. Retenter un upload CV.
3. Si échec : noter dans le message UI / Runtime Logs la ligne `projet=… bucket=aster-private-docs urlSource=…`.
4. Dans Supabase Dashboard du **même** `projet=…` : Storage → confirmer `aster-private-docs` (privé). Sinon créer le bucket **sur ce projet** ou corriger les env Vercel pour pointer vers le projet où il existe déjà.
5. Optionnel local : `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/verify-storage-bucket.ts`
