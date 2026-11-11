# ASTER — Rapport de progression

**Date / heure :** 11 novembre 2026 ~22:52 UTC  
**Branche :** `main`  
**Sujet :** Modèle Excel d'import RH strictement auto-validant (listes déroulantes)  
**État :** terminé localement (tests / typecheck / lint / build OK) — commit/push à enchaîner.

---

## Ce qui a changé

- Feuille `Listes` alignée sur l'importateur : plus de `Autre` / `À préciser` ; ajout de `Alternance`.
- Listes déroulantes + messages FR pour départements, sites, contrats, statuts, types de solde, unités, vérification RH, historique.
- Validations Excel date (embauche, sortie, effet) et décimal ≥ 0 (soldes / quantités).
- `Nom*` / `Prénom*` restent en saisie libre (aucun dropdown).
- Source de vérité TS : `accepted-values.ts` ; régénération : `npm run build:hr-import-template`.
- Asset canonique régénéré (SHA-256 `e0b2bcb8…42ccd`) — téléchargement UI inchangé (lit l'asset).
- Validation serveur inchangée (toujours rejet des valeurs hors contrat).

## Fichiers

| Fichier | Action |
|---------|--------|
| `assets/hr-import/ASTER_Modele_Import_RH_Maroc.xlsx` | régénéré |
| `src/domain/rules/hr-import/accepted-values.ts` | créé |
| `scripts/build-hr-import-template.ts` | créé |
| `src/domain/rules/hr-import/template-self-validation.test.ts` | créé |
| `src/domain/rules/hr-import/official-workbook.parse.test.ts` | hash |
| `src/application/services/hr-import-service.test.ts` | hash |
| `e2e/hr-import-official.spec.ts` | hash |
| `docs/EMPLOYEE_IMPORT_GUIDE.md` | champs / listes |
| `package.json` | script `build:hr-import-template` |
| `docs/PROGRESS.md` | rapport frais |

## Dépendances

- Aucune nouvelle dépendance npm.

## Migrations / seed

- Aucun. Aucun seed Production.

## Tests / QA

| Contrôle | Résultat |
|----------|----------|
| Vitest | **316 passed**, 1 skipped (60 files) |
| `npm run typecheck` | **OK** |
| `npm run lint` | **OK** |
| `npm run build` | **OK** |

## Limites connues

1. Listes département / site basées sur le **seed démo** (template statique) ; un nouveau site hors liste est possible avec style Excel `warning`.
2. Excel ne peut pas exiger facilement « obligatoire seulement si la ligne est remplie » — les lignes vides restent `allowBlank` ; le serveur valide les lignes non vides.
3. Pas de civilité / genre dans le contrat d'import actuel — non inventés.

## Travail restant

1. Commit + push `origin/main`.
2. Vérifier dans Excel desktop / LibreOffice : dropdowns Collaborateurs + Soldes.
3. (Optionnel) Playwright rejoué pour le hash de téléchargement.

## Prochaine étape exacte

Committer et pousser, puis ouvrir le modèle téléchargé depuis `/administration/import-collaborateurs` et contrôler les listes `Type de contrat` / `Statut*` / `Département`.
