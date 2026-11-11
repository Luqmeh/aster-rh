# ASTER — Rapport de progression

**Date / heure :** 11 novembre 2026 ~22:15 UTC  
**Branche :** `main`  
**Sujet :** Diagnostic et correctif « Minified React error #441 » sur l’import RH  
**État :** cause racine identifiée, correctif poussé — commit `6154533` sur `origin/main` (déploiement Vercel à attendre).

---

## Cause racine exacte

React **#441** = erreur survenue dans un Server Component / Server Action, message masqué en production.

**Preuve Production (Vercel logs, déploiement `dpl_BhF3UegMt4YhXC2boLV7BjxU4CpR`) :**

- Route : `POST /administration/import-collaborateurs`
- Exception serveur : `Error: Des lignes invalides restent présentes — corrigez le fichier ou retirez-les.`
- Stack : `confirmAndExecute` → `executeHrImportAction`
- Digest : **`1668436741`**

**Chaîne :**

1. Upload / validate d’un classeur avec lignes en `severity: "error"`.
2. `validateBatch` mettait quand même le lot en `awaiting_confirmation` → l’UI affichait **IMPORTER**.
3. `executeHrImportAction` **lançait** l’erreur métier (`throw`).
4. En production, Next/React masque le message → le navigateur affiche **Minified React error #441** (digest `1668436741`).

Ce n’est **pas** une erreur d’hydratation ni un problème d’auth/DB générique. C’est bien lié au workflow d’import (confirmation avec lignes invalides + throw depuis Server Action).

## Route / action concernées

| Élément | Détail |
|---------|--------|
| Page | `/administration/import-collaborateurs` |
| Action | `executeHrImportAction` (et les autres actions import qui throwaient) |
| Service | `hr-import-service.confirmAndExecute` / `validateBatch` |

## Correctif

1. **Actions import** renvoient `{ ok: true | false, message? }` — plus de throw métier (aligné absences / recrutement) → plus de #441 pour ce cas.
2. **`validateBatch`** : statut `validated` + `errorMessage` si lignes invalides ; `awaiting_confirmation` seulement si aucune erreur bloquante.
3. **UI** : pas de formulaire IMPORTER si `validated` ; message explicite ; recalcul possible.

## Reproduction

**Avant correctif (local, mémoire) :**  
`status_after_validate= awaiting_confirmation` puis throw `Des lignes invalides…` (identique aux logs Vercel).

**Après correctif :**  
`status_after_validate= validated` + confirmation refusée ; Playwright « lot invalide » : message FR visible, bouton IMPORTER absent, **aucun** texte `#441`.  
Happy-path E2E import officiel : toujours **passé**.

**Note `next start` HTTP local :** cookies `__Secure-*` (`NODE_ENV=production`) empêchent le login sur `http://127.0.0.1` — hors sujet du #441 ; Production Vercel est en HTTPS.

## Fichiers modifiés / créés

- `src/app/actions/hr-import.ts` — résultats structurés
- `src/app/actions/hr-import.test.ts` — **nouveau** (régression #441 / no-throw)
- `src/application/services/hr-import-service.ts` — gating `validated`
- `src/application/services/hr-import-service.test.ts` — régression lot invalide
- `src/components/modules/hr-import-wizard.tsx` — UI / assertOk
- `e2e/hr-import-official.spec.ts` — scénario lot invalide
- `docs/PROGRESS.md` — ce rapport (fichier précédent **supprimé** puis réécrit)

## Dépendances

- Aucune.

## Migrations / schéma

- Aucun. Aucun seed / reset Production.

## Résultats QA

| Contrôle | Résultat |
|----------|----------|
| Vitest | **306 passed**, 1 skipped (59 files) |
| Playwright import (dev) | **2 passed** (invalide + happy path) |
| `npm run typecheck` | **OK** |
| `npm run lint` | **OK** |
| `npm run build` | **OK** |

## Problèmes connus / incertitudes

1. Lots Production déjà en `awaiting_confirmation` avec erreurs : IMPORTER peut encore s’afficher jusqu’au recalcul / re-upload ; l’action renvoie alors le message FR (`ok: false`) au lieu de #441.
2. Contenu exact du classeur uploadé en Production (22:01 UTC) non retenu dans les logs — seulement le message métier.
3. Login navigateur contre `next start` en HTTP local bloqué par cookies secure (attendu).

## Prochaine étape recommandée

Après déploiement Vercel de `6154533`, rejouer sur `aster-rh.vercel.app` : upload fichier invalide → message FR / statut `validated`, pas de #441 ; puis un import valide → `IMPORTER` OK.
