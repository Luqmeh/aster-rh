# ASTER — Grand livre des congés (Phase 1 + 2)

## Objectif

Remplacer l’arithmétique fragile des soldes (`LeaveBalance.*Restants` mis à jour de façon partielle) par un **grand livre append-only** (`LeaveLedgerEntry`) comme **source de vérité**.

`LeaveBalance` reste une **projection cache** dérivée du ledger (compatibilité UI / exports).

Phase 2 ajoute les **politiques d’acquisition**, le **moteur d’accrual (preview → post)** et les **écritures carryover / expiry** — sans second système de soldes.

## Comptes suivis

| Compte | Unité | Notes |
|--------|-------|-------|
| `conges_payes` | days | Legacy Phase 1 (ouvertures historiques) |
| `conges_payes_acquis` | days | CP acquis (période close + reports) — guide p.38–48 |
| `conges_payes_en_acquisition` | days | CP juin N → mai N+1 |
| `rtt` | days | Séparé des CP |
| `recuperation` | days | Crédits WOH |

**Solde CP UI / contrôle** = somme du pool (`conges_payes` + `acquis` + `en_acquisition`).

Les catégories sans solde (maladie LeaveRequest, exceptionnel, parental, sans solde, WorkAbsence / congés spéciaux événementiels) **ne sont pas** des comptes ledger accumulés.

## Types d’écriture

| Type | Sens typique |
|------|----------------|
| `opening_balance` | Snapshot migration (acquis +, pris −) |
| `accrual` | Crédit d’acquisition (Phase 2 — posting contrôlé) |
| `leave_consumption` | Débit à l’approbation CP/RTT |
| `recovery_credit` | Crédit après confirmation WOH |
| `recovery_consumption` | Débit à l’approbation d’une demande `recuperation` |
| `carryover` | Report CP approuvé (crédit cible) |
| `expiry` | Perte RTT 1er juillet / débit sortant report CP |
| `hr_adjustment` | Ajustement RH/Chef (motif obligatoire) |
| `reversal` | Contrepassation |

## Immutabilité & idempotence

- Pas d’UPDATE/DELETE métier des écritures.
- Contrainte unique `(sourceKind, sourceId, transactionType)`.
- Accruals : `sourceKind=entitlement_accrual`, `sourceId=idempotencyKey`.
- Carryover : `entitlement_carryover_in` / `_out`.
- Expiry RTT : `entitlement_expiry`.
- Corrections = nouvelles écritures (`reversal` / `hr_adjustment`).

## Politiques (Phase 2)

Source : **Guide RH PKF Arsilon nov. 2026, p.38–48** (spéciaux p.45–47).

- Versions seed : `src/domain/rules/entitlement-policies.ts`
- Calcul preview : `src/domain/rules/entitlement-accrual.ts`
- Service : `src/application/services/entitlement-service.ts`
- UI RH : `/administration/droits-conges`
- Doc détaillée : `docs/ENTITLEMENT_ENGINE.md`

Une nouvelle version de politique **ne réécrit pas** les écritures déjà postées.

## Définitions de solde (autoritatives)

Inchangées Phase 1 pour un compte / année ; pour CP, utiliser le **pool** via `computeCpPooledBalance`.

Pending ≠ consommation. Consommation réelle à l’**approbation**.

Consommation CP : débit réparti `acquis` → `legacy` → `en_acquisition` (sourceId `requestId:account`).

## Migration / backfill

1. Phase 1 : `20261110020000_leave_ledger`
2. Phase 2 : `20261110030000_entitlement_engine` (comptes CP split, calendriers, policies, batches, carryover) — **additive**
3. Ouvertures LeaveBalance **intactes** ; pas d’accruals historiques inventés
4. Migrate Production uniquement via pipeline Vercel (`docs/DEPLOYMENT.md`)

## RBAC

- Collaborateur : solde / historique **soi uniquement**
- RH / Chef : administration des droits (`/administration/droits-conges`)
- RH : **toujours** sans approbation manager-controlled des demandes de congés
- Médical / justificatifs spéciaux : RH uniquement

## Hors scope

Paie, solde de tout compte automatique, sync Kammi, scheduler d’accrual silencieux, formules statutaires temps partiel non validées, conformité légale « complète ».
