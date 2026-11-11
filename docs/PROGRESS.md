# ASTER — Progress Report

**Date :** 11 novembre 2026  
**Branche :** `main`  
**Phase :** Audit & implémentation des calculs RH Maroc (post-alignement présentation `fb8101f`)

> Rapport généré à neuf (ancien fichier supprimé). Matrice détaillée : `docs/CALCULATION_POLICY_MATRIX.md`.

## 1. Implemented calculations

- **CAP dual-rate** : statutaire art. 231 (1,5 / 2) **et** entreprise **2 j/mois total** (non cumulés) ; ancienneté art. 232 sur la base applicable ; plafond 30.
- **Politiques** : `MA_ANNUAL_LEAVE_STATUTORY` (référence) + `MA_ANNUAL_LEAVE_COMPANY` (`requires_hr_decision`) ; priorité entreprise en preview.
- **Posting auto** : uniquement `validationStatus === hr_configured` (plus de posting via `guide_documented`).
- **Jours de congé** : `countBusinessDays` exclut fériés Maroc + overrides entreprise ; demi-journées conservées.
- **Soldes UI** : CP / RTT / récupération = `availableAfterReservations` (pending réserve, approval consomme 1× via ledger).
- **Télétravail** : limites 2/12 centralisées et configurables (`ASTER_TELEWORK_MAX_DAYS_PER_*`).
- **Récupération fériée** : règle produit 1 h = 1 h documentée ; distincte du régime légal à valider.

## 2. Modified files

- `src/domain/rules/morocco-annual-leave.ts` (+ tests)
- `src/domain/rules/entitlement-policies.ts`, `entitlement-accrual.ts` (+ tests)
- `src/domain/rules/leave.ts` (+ tests), `work-on-holiday.ts`, `telework-monthly.ts`
- `src/domain/config/telework-limits.ts` (+ tests)
- `src/application/services/leave-service.ts`, `entitlement-service.ts` (+ tests)
- `src/domain/types/entitlement.ts` (`policyCode` sur lignes de lot)
- `src/app/(app)/administration/droits-conges/page.tsx`
- `docs/CALCULATION_POLICY_MATRIX.md`, `MOROCCO_HR_POLICY.md`, ce rapport
- `.env.example`

## 3. Database changes and migrations

**Aucune migration** dans cette phase. Aucun rewrite ledger. Aucun bulk accrual Production.

## 4. Tests and validation results

| Check | Result |
|-------|--------|
| Vitest focused (54 tests, 8 files) | **PASS** |
| `tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` (offline) | **PASS** |

## 5. Known issues

- Week-end réel par site (ven–sam) non branché.
- Art. 235 (extension congé si férié pendant absence) non implémenté.
- Art. 239 assimilations absences non branchées.
- Projection cache `LeaveBalance` reste nette ledger (sans pending) ; l’UI self-service utilise désormais les snapshots avec réservations.

## 6. Unverified policies

- Confirmation formelle du **2 j/mois entreprise** + passage `hr_configured`.
- Interaction définitive ancienneté art. 232 sur base 24 j.
- RTT Maroc (avantage employeur ?).
- Plafonds congés spéciaux.
- Régime légal complet du travail un jour férié (au-delà de 1 h = 1 h produit).

## 7. Remaining work

1. RH confirme politique entreprise → `hr_configured`.
2. Pilote preview/post contrôlé (pas de bulk).
3. Brancher timesheet pour TP / art. 238-2.
4. Art. 235 / 239 si validés.

## 8. Exact next recommended step

Faire valider par RH le document `docs/CALCULATION_POLICY_MATRIX.md` (ligne CAP entreprise 2 j/mois), puis basculer `MA_ANNUAL_LEAVE_COMPANY.validationStatus` à `hr_configured` **uniquement** après confirmation écrite — sans lancer d’accrual Production automatique.
