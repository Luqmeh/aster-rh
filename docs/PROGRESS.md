# ASTER — Rapport de progression

**Date / heure :** 11 novembre 2026 ~21:40 UTC  
**Branche :** `main`  
**Phase :** Critical — alignement import Excel sur le modèle officiel `ASTER_Modele_Import_RH_Maroc.xlsx`  
**État :** **terminée** (implémentation + E2E + QA locale OK). Commit/push à enchaîner.

---

## Fonctionnalités implémentées

- Modèle officiel unique téléchargeable (asset + SHA-256 `dbc617d2…ccacc9`).
- Parseur OOXML (JSZip) — ExcelJS contourné (commentaires / tables).
- En-têtes ligne 4 ; feuilles officielles ; soldes format long `(matricule, type)`.
- Statuts Actif/Suspendu/Sorti ; `RECUPERATION_HEURES` en **heures** (pas de conversion jours).
- Service + actions + wizard : un seul bouton de téléchargement du modèle officiel.
- Réconciliation agrégée par matricule (format long).
- Seed credentials mémoire via `ASTER_SEED_PASSWORD` (login démo / Playwright).
- Endpoint inspect E2E gated (`ASTER_E2E_INSPECT=1`).
- Playwright E2E navigateur bout-en-bout.
- Guide import réécrit autour du modèle officiel.

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `assets/hr-import/ASTER_Modele_Import_RH_Maroc.xlsx` | Modèle canonique |
| `src/domain/rules/hr-import/ooxml-workbook.ts` | Lecture OOXML |
| `src/domain/rules/hr-import/official-workbook-fixture.ts` | Fixture remplissage tests/E2E |
| `src/domain/rules/hr-import/official-workbook.parse.test.ts` | Tests parse officiel |
| `src/infrastructure/auth/memory-seed-accounts.ts` | Seed comptes mémoire |
| `src/app/api/e2e/hr-import-inspect/route.ts` | Inspect magasin E2E |
| `e2e/hr-import-official.spec.ts` | Spec Playwright |
| `playwright.config.ts` | Config E2E (port 3111, mémoire) |

## Fichiers modifiés

- `package.json` / `package-lock.json` — `@playwright/test`, script `test:e2e`
- `src/app/actions/hr-import.ts`
- `src/application/services/hr-import-service.ts` (+ `.test.ts`)
- `src/components/modules/hr-import-wizard.tsx`
- `src/domain/rules/hr-import/parse.ts`, `templates.ts`, `validate.ts` (+ `.test.ts`)
- `src/domain/types/hr-import.ts`
- `src/infrastructure/auth/account-store.ts`
- `docs/EMPLOYEE_IMPORT_GUIDE.md`, `docs/PROGRESS.md`

**Non inclus :** `docs/git ssh.txt` (secrets locaux — ne pas committer).

## Dépendances

- **Ajouté :** `@playwright/test` ^1.65.0 (devDependency)
- Chromium Playwright déjà installé localement
- Aucune autre dépendance runtime

## Migrations / schéma DB

- Aucun changement Prisma / migration pour cette phase.

## Résultats QA

| Contrôle | Résultat |
|----------|----------|
| Vitest | **303 passed**, 1 skipped (58 files) |
| Playwright `e2e/hr-import-official.spec.ts` | **1 passed** (~24 s) |
| `npm run typecheck` | **OK** |
| `npm run lint` | **OK** |
| `npm run build` (offline) | **OK** |

### E2E — preuves

- Login RH mémoire `sara.benali@demo.aster-rh.local`
- Download modèle = hash officiel
- Upload classeur rempli → prévisualisation → `IMPORTER`
- Rapport : 2 créés, 3 soldes, 1 compte créé + 1 pending
- Inspect : ledger `recuperation` `hours=7`, `conges_payes` OK, `mustChangePassword=true`

## Problèmes connus

1. Warning Next.js : convention `middleware` → `proxy` (hors scope).
2. `docs/git ssh.txt` reste untracked — à laisser hors git.
3. Champ rapport `excelRecoveryDays` peut contenir des **heures** quand le type officiel est `RECUPERATION_HEURES` (libellé historique ; UI recon montre surtout CP/RTT).

## Tâches restantes

1. Commit + push sur `origin/main` (hors `docs/git ssh.txt`).
2. (Optionnel) renommer / scinder le champ récupération du rapport Excel pour distinguer jours vs heures.
3. (Optionnel) migrer `middleware` → `proxy` Next.js 16.

## Prochaine étape recommandée

Committer et pousser cette phase, puis enchaîner la roadmap démo (SSO Entra / polish UI) selon `docs/ROADMAP.md`.
