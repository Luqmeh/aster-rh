# ASTER — Rapport d'avancement

**Date :** 11 novembre 2026  
**Phase :** Import Excel collaborateurs & soldes d'ouverture (Maroc)

## Fonctionnalités livrées

- Section **Administration → Import des collaborateurs** (`/administration/import-collaborateurs`).
- Permissions serveur : `hr.import.view` (RH + Chef), `hr.import.execute` (RH uniquement).
- Modèles Excel A (collaborateurs), B (soldes d'ouverture), C (historique optionnel non exécuté).
- Workflow : upload → parse → mapping → validation → prévisualisation → confirmation `IMPORTER` → exécution lot → rapport de réconciliation téléchargeable.
- Soldes importés en écritures ledger append-only (`opening_balance` / `hr_excel_import_opening`), idempotentes par `sourceId` lot+matricule+compte.
- Pas de recalcul d'acquisition historique, pas d'écrasement silencieux de soldes, pas d'invention d'e-mails/credentials.
- Guide : `docs/EMPLOYEE_IMPORT_GUIDE.md`.

## Fichiers modifiés / ajoutés

- `src/domain/types/hr-import.ts`
- `src/domain/rules/hr-import/{templates,parse,validate}.ts` + `validate.test.ts`
- `src/application/services/hr-import-service.ts` + `hr-import-service.test.ts`
- `src/app/actions/hr-import.ts`
- `src/components/modules/hr-import-wizard.tsx`
- `src/app/(app)/administration/import-collaborateurs/page.tsx`
- `src/lib/navigation.ts`, `src/app/(app)/administration/page.tsx`
- `src/domain/rules/permissions.ts` (+ tests)
- `prisma/schema.prisma` + migration `20261111180000_hr_import_batches`
- `docs/EMPLOYEE_IMPORT_GUIDE.md`, `docs/PROGRESS.md` (remplacé)
- Ajustements tests congés/calendrier (RTT→CP, jours fériés, timeout bcrypt)

## Changements base de données

- Table additive `HrImportBatch` (statuts, mappings JSON, drafts, rapport d'exécution).
- Lots runtime encore en mémoire process (table Prisma prête pour persistance durable).
- Ouvertures ledger via `LeaveLedgerEntry` existant (pas de rewrite historique).

## Tests et validation

| Contrôle | Résultat |
|----------|----------|
| `npm test` | 297 passed, 1 skipped |
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK (route import présente) |

Couverture import : validation (doublons, négatifs, matricules inconnus), service (droits, import soldes idempotent, Chef sans exécution), permissions.

## Problèmes connus

- Persistance des lots d'import encore en mémoire (redémarrage process = perte des lots ; table Prisma non branchée en écriture).
- Échec partiel mid-exécution peut laisser des collaborateurs déjà créés (réessai via nouveau lot / mode mise à jour explicite).
- Template C historique non exécutable (volontaire).
- Mapping colonnes avancé UI limité (auto-détection + option mise à jour existants).

## Travail restant

- Brancher `HrImportBatch` Prisma pour lots durables multi-instance.
- UI de mapping colonne / département / site plus fine.
- Exécuteur historique (template C) si le métier le demande.
- Tests d'intégration Prisma import (avec `DATABASE_URL`).

## Prochaine étape exacte

Persister les lots d'import via l'adaptateur Prisma (`HrImportBatch`) et conserver le buffer source uniquement en stockage privé, pour un retry fiable hors mémoire process.
