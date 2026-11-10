# ASTER — Grand livre des congés (Phase 1)

## Objectif

Remplacer l’arithmétique fragile des soldes (`LeaveBalance.*Restants` mis à jour de façon partielle) par un **grand livre append-only** (`LeaveLedgerEntry`) comme **source de vérité**.

`LeaveBalance` reste une **projection cache** dérivée du ledger (compatibilité UI / exports).

## Comptes suivis

| Compte | Unité ledger | Notes |
|--------|--------------|-------|
| `conges_payes` | days | Séparé des RTT |
| `rtt` | days | Séparé des CP |
| `recuperation` | days | Heures WOH conservées dans `RecoveryCreditLedger` ; conversion jours créditée ici |

Les catégories sans solde (maladie LeaveRequest, exceptionnel, parental, sans solde, WorkAbsence) **ne sont pas** des comptes ledger → « Solde non suivi ».

## Types d’écriture

| Type | Sens typique |
|------|----------------|
| `opening_balance` | Snapshot migration (acquis +, pris −) |
| `accrual` | Crédit d’acquisition (phases futures) |
| `leave_consumption` | Débit à l’approbation CP/RTT |
| `recovery_credit` | Crédit après confirmation WOH |
| `recovery_consumption` | Débit à l’approbation d’une demande `recuperation` |
| `carryover` / `expiry` | Réservés phases futures |
| `hr_adjustment` | Ajustement RH/Chef (motif obligatoire) |
| `reversal` | Contrepassation d’une écriture existante |

## Immutabilité & idempotence

- Pas d’UPDATE/DELETE métier des écritures.
- Contrainte unique `(sourceKind, sourceId, transactionType)`.
- `appendLeaveLedgerEntry` renvoie l’existant si déjà présent.
- Corrections = nouvelles écritures (`reversal` / `hr_adjustment`).

## Définitions de solde (autoritatives)

Pour un compte / année :

1. **totalCredited** — somme des crédits (ouvertures positives, accruals, recovery_credit, …).
2. **totalConsumed** — somme des |débits| de consommation (+ ouvertures « pris »).
3. **totalExpired** — |expiry|.
4. **totalAdjustments** — somme signée des `hr_adjustment`.
5. **ledgerBalance** — Σ toutes écritures.
6. **otherPendingReservations** — Σ `daysCount` des LeaveRequest pending **même compte**, hors demande courante (pas une écriture).
7. **availableAfterReservations** — `ledgerBalance − otherPendingReservations`.
8. **projectedAfterCurrentRequest** — `availableAfterReservations − currentRequestDays`.

Les demandes **pending ne consomment pas** le ledger. La consommation réelle est postée **à l’approbation** (Phase 1 — migration volontaire ; auparavant aucun débit).

## Migration / backfill

1. Migration additive Prisma `20261110020000_leave_ledger` (table + enums + indexes).
2. Pour chaque `LeaveBalance` existant : écritures `opening_balance` acquis (+) et pris (−) si non nuls.
3. **Aucun** historique de demandes individuelles inventé.
4. Idempotent via `sourceKind=leave_balance_opening` + `sourceId={employeeId}:{year}:{account}:{acquis|pris}`.
5. Date d’effet documentée : `2026-01-01` (année démo).

## Cycle de vie demandé

| Événement | Effet ledger |
|-----------|--------------|
| Submit | Contrôle `availableAfterReservations` ; **pas** d’écriture |
| Approve | `leave_consumption` / `recovery_consumption` (idempotent) |
| Refuse / cancel | Aucune écriture ; réservation pending disparaît |
| WOH confirm+credit | `recovery_credit` (+ `RecoveryCreditLedger` heures) |
| HR adjust | `hr_adjustment` |

## RBAC

- Collaborateur : solde / historique **soi uniquement**.
- RH / Chef : lecture globale ; ajustements RH/Chef.
- RH : **toujours** sans approbation manager-controlled.
- Médical : inchangé (pas dans le ledger).

## Hors scope Phase 1

Accruals mensuels auto, politiques configurables, ancienneté, jobs d’expiry/carryover, UI complète d’administration des droits, solde de tout compte départ.
