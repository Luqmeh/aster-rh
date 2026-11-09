# ASTER — Progress report

**Date :** 2026-11-09  
**Focus :** Correctif urgent React #441 (recrutement / CV)  
**Statut :** Correctif poussé — **workflow Production pas encore re-vérifié après déploiement**

## Cause réelle (logs runtime Vercel)

Entrée runtime Production (pas un log de build) :

- **Deployment :** `dpl_CnaoFsthEgsqFExPjmQFSmxUm21M` (`aster-kjj53nm10-…`)
- **Request :** `POST /entretiens/rec-mw8as5bh-884xe`
- **Niveau :** `error` / function / `cdg1` / `nodejs26.x`
- **Message :** `Error: Un CV est obligatoire avant soumission.`
- **Digest :** `1412190641`
- **Stack :** `recruitment-service.submit` → `recruitment` Server Action (throw)

React #441 masque cette exception côté navigateur. L’erreur s’affichait sous le formulaire candidat (zone partagée avec les contrôles CV) après « Soumettre pour revue » sans CV.

Env Production : `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sont présentes ; le mock Storage n’est pas la cause de ce digest.

## Changements

1. **Server Actions recrutement** — plus de throw vers le client : retour `{ ok, message }` (FR) pour create/update/upload/submit/decide/assign/CV URL.
2. **Upload CV** — `FormData` natif (`candidateId` + `cv`) au lieu de base64 Server Action args.
3. **UI** — lit `result.ok` / `result.message` (plus de try/catch sur throw masqué).
4. **Container** — `storage` lazy : `createDocumentStorage()` seulement à l’accès CV (évite un assert Storage sur tout le layout).
5. **Tests** — régression FormData + conversion erreur stockage + digest prod « CV obligatoire ».

## Fichiers modifiés / ajoutés

| Fichier | Rôle |
|---------|------|
| `src/app/actions/recruitment.ts` | Actions non-throwing + upload FormData |
| `src/components/modules/recruitment-forms.tsx` | Feedback métier via `result.ok` |
| `src/infrastructure/container.ts` | Getter lazy `storage` |
| `src/app/actions/recruitment-cv-upload.test.ts` | Régressions upload/submit #441 |
| `src/infrastructure/container-storage-lazy.test.ts` | Laziness storage |
| `docs/PROGRESS.md` | Rapport frais (remplacé) |

## Dépendances

Aucune nouvelle dépendance npm.

## Résultats tests ciblés

```
npx vitest run src/app/actions/recruitment-cv-upload.test.ts \
  src/infrastructure/container-storage-lazy.test.ts
→ 6 passed
```

Autres déjà verts dans la même session : `supabase-storage.test.ts`, `recruitment-service.test.ts`.

## Typecheck / lint / build

| Check | Résultat |
|-------|----------|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` (`ASTER_BUILD_WITHOUT_DB=1`) | OK |

## Non modifié (volontaire)

- Hiérarchie rôles (HR crée/upload ; Chef décide ; HR ne décide pas)
- Bucket privé `aster-private-docs`
- Pas de fallback mock Storage en Production
- Pas de redesign UI

## Issues restantes

- **Production non re-vérifiée** après ce commit : attendre le déploiement Vercel, puis tester soumission sans CV (message FR clair, pas #441) et upload CV réel.
- Si un digest Storage apparaît après déploiement, chercher dans Runtime Logs : `Échec upload stockage`, `Stockage Supabase requis`, ou digest associé — **ne pas confondre avec Build Logs**.

## Prochaine étape exacte

1. Après déploiement de ce commit sur `aster-rh.vercel.app`.
2. Se connecter RH → dossier brouillon → **Soumettre pour revue** sans CV → attendre le message « Un CV est obligatoire avant soumission. » (pas React #441).
3. Téléverser un PDF ≤ 5 Mo → succès, puis soumettre.
4. Si échec upload : ouvrir **Vercel → Project aster-rh → Logs (Runtime / Functions)** pour le `POST` sur `/entretiens/[id]` et noter `message` + `digest`.
