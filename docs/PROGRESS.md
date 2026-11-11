# ASTER — Rapport d'avancement

**Date :** 11 novembre 2026  
**Phase :** Lots d'import RH durables + provisioning comptes collaborateurs

## Fonctionnalités livrées

- Persistance durable des lots `HrImportBatch` (Prisma PostgreSQL + store démo mémoire).
- Cycle de vie : `uploaded` → `validating` → `awaiting_confirmation` → `executing` → `completed` | `completed_with_errors` | `failed`.
- Claim atomique d'exécution (anti-concurrence / anti-double run).
- Récupération manuelle des lots interrompus (`recoverInterruptedBatch`) — **aucun** retry background.
- Reprise après `failed` avec idempotence ledger (`hr_excel_import_opening`) et non-écrasement des credentials.
- Compteurs et rapport de réconciliation persistés (plus dépendants du process memory).
- Stockage privé des classeurs + `getObject` pour rehydratation après redémarrage.
- Provisioning de comptes à l'import : rôle `collaborateur` uniquement, `mustChangePassword`, mot de passe temporaire hors rapport (e-mail seulement).
- E-mail pro absent → fiche importable, compte `pending`.
- Reprovisioning / reset explicite RH (`reprovisionImportedAccount`).
- Guide mis à jour : `docs/EMPLOYEE_IMPORT_GUIDE.md`.

## Fichiers modifiés / ajoutés

- `src/domain/types/hr-import.ts`
- `src/domain/rules/hr-import/validate.ts`
- `src/infrastructure/persistence/hr-import-batch-store.ts` (nouveau)
- `src/infrastructure/persistence/demo-store.ts`
- `src/infrastructure/storage/{types,mock-storage,supabase-storage}.ts`
- `src/application/services/hr-import-service.ts` (+ tests)
- `src/app/actions/hr-import.ts`, page import, wizard
- `prisma/schema.prisma`
- `prisma/migrations/20261111190000_hr_import_batches_durable/`
- `docs/EMPLOYEE_IMPORT_GUIDE.md`, `docs/PROGRESS.md` (remplacé)

## Base de données

Migration forward-only additive `20261111190000_hr_import_batches_durable` :

- Colonnes : `importType`, `templateVersion`, compteurs, `provisioningResultsJson`, `failureSummary`, `validatedAt`, `executionStartedAt`
- Index `executedAt`
- Aucune réécriture ledger / seed Production

## Tests et validation

| Contrôle | Résultat |
|----------|----------|
| `npm test` | 301 passed, 1 skipped |
| `npm run typecheck` | OK |
| `npm run lint` | (à confirmer après correctifs hooks) |
| `npm run build` | OK |

Couverture ajoutée : persistance après reset cache, concurrence, reprise interrupted, e-mail manquant, non-écrasement credentials, droits Chef/Collab.

## Problèmes connus

- Mode mémoire : lots dans le demo-store process (pas multi-instance) ; Prisma requis en prod.
- Mot de passe temporaire visible une seule fois via e-mail (ou retour API reprovisioning RH) — pas d'historique plaintext.
- Template C historique toujours non exécuté.

## Travail restant

- UI dédiée « récupérer lot interrompu » / historique multi-lots.
- Écran RH de provisioning différé pour les fiches `pending` (saisie e-mail puis compte).
- Tests d'intégration Prisma import sur vraie `DATABASE_URL`.

## Prochaine étape exacte

Ajouter dans l'assistant d'import une action RH « Marquer failed / reprendre » pour les lots `executing` bloqués, branchée sur `recoverInterruptedBatch`.
