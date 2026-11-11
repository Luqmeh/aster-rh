# ASTER — Moteur d’acquisition & politiques (Phase 2 → Morocco-first)

## Source active

**Département Maroc** — voir `docs/MOROCCO_HR_POLICY.md` (loi 65-99, validation RH).

Les politiques issues du guide RH **France** (p.38–48) sont conservées en **historique désactivé** (`jurisdiction=FR`, `isActive=false`) pour comprendre d’anciennes métadonnées ledger. Elles ne sont **jamais** utilisées pour preview/post Maroc.

La politique `MA_ANNUAL_LEAVE_STATUTORY` (baseline 1,5 j/mois proposée) reste `requires_hr_decision` : **aucun posting automatique** tant que non `hr_configured`.

## Règles implémentées (avec référence)

| Règle | Implémentation | Source |
|-------|----------------|--------|
| CP 2,08 j/mois | `CP_MONTHLY_ACCRUAL_DAYS` | p.38–48 |
| Période CP 1er juin → 31 mai | `cpAcquisitionPeriodContaining` | p.38–48 |
| CP acquis ≠ en acquisition | Comptes ledger dédiés | p.38–48 |
| CDI / CDD / alternants → CP | `isCpEligible` | p.38–48 |
| Alternants sans RTT | `isRttEligible` | p.38–48 |
| RTT non-cadre 11 j | politique `RTT_NON_CADRE_JUL_JUN` | p.38–48 |
| RTT cadre 7–11 j | calendrier bureau validé | p.38–48 |
| Période RTT 1er juil. → 30 juin | `rttAcquisitionPeriodContaining` | p.38–48 |
| Demi-journée RTT | `allowHalfDay` | p.38–48 |
| Pas de report RTT / expiry 1er juil. | `previewOrPostRttExpiry` | p.38–48 |
| Cibles 70 % / 30 % | `usageTargets` (pas des crédits) | p.38–48 |
| Négatif RTT max 6 j | `negativeBalance` policy | p.38–48 |
| Report CP max 5 j non cumulable | `assertCarryoverWithinPolicy` | p.38–48 |
| Exception report | partenaire + plan 31/12 + décision RH | p.38–48 |
| Spéciaux événementiels | `SPECIAL_LEAVE_ENTITLEMENTS` | p.45–47 |

## Règles nécessitant validation RH

- Temps partiel (pas de × % activité)
- Mois partiel d’emploi (pas de prorata inventé)
- RTT cadre sans calendrier de bureau validé
- Horaires ≠ 39 h/sem
- Arrondi fin de période CP (exemple 10,4 → 11) — **opt-in**
- Exceptions de report > 5 j
- Plafonds spéciaux marqués `hypothese_demo`

## Flux accrual

1. RH ouvre `/administration/droits-conges`
2. Preview mensuelle déterministe (explication + statut)
3. Création d’un **lot** `preview`
4. Posting contrôlé des seules lignes `calculated` & quantité > 0
5. Écritures `accrual` sur le ledger Phase 1 (idempotency key)

Pas de job background non audité. Pas de posting Production automatique au déploiement.

## Statuts de calcul

- `calculated`
- `requires_hr_validation`
- `missing_employment_information`
- `missing_policy_configuration`
- `ineligible`

## Fichiers clés

- `src/domain/rules/entitlement-policies.ts`
- `src/domain/rules/entitlement-accrual.ts`
- `src/application/services/entitlement-service.ts`
- `src/app/(app)/administration/droits-conges/page.tsx`
- Migration `prisma/migrations/20261110030000_entitlement_engine/`
