# ASTER — Rapport de progression (frais)

**Date :** 10 novembre 2026  
**Périmètre :** Phase 2 — politiques d’acquisition & moteur d’accrual (intégration ledger Phase 1)  
**Auteur rapport :** agent Auto (Composer)

## Fonctionnalités livrées

- Politiques d’acquisition versionnées (seed guide) : CP, RTT cadre / non-cadre, report CP, expiry RTT.
- Moteur d’accrual déterministe avec **preview** puis **posting contrôlé** vers le ledger append-only.
- Comptes CP distincts : `conges_payes_acquis`, `conges_payes_en_acquisition` (+ legacy `conges_payes`).
- Solde CP UI / contrôles / exports = **pool** des trois comptes.
- Consommation CP à l’approbation répartie acquis → legacy → en acquisition.
- Champs employment : temps partiel, heures hebdo, % activité, calendrier de bureau.
- Reports CP (plafond 5 j) et expiry RTT (1er juillet) via écritures ledger auditées.
- Congés spéciaux restés **événementiels** (pas de solde cumulatif).
- UI RH `/administration/droits-conges` (éligibilité, preview, lots, reports, catalogue spéciaux).
- RBAC inchangé : RH administre les droits sans approuver les demandes manager-controlled.

## Règles guide implémentées (références)

| Règle | Source |
|-------|--------|
| CP 5 semaines, 2,08 j/mois, juin→mai | Guide RH nov. 2026 p.38–48 |
| CP acquis ≠ en acquisition | p.38–48 |
| CDI/CDD/alternants éligibles CP | p.38–48 |
| Alternants exclus RTT | p.38–48 |
| RTT non-cadre 11 j, période juil.→juin | p.38–48 |
| RTT cadre 7–11 j via calendrier bureau | p.38–48 |
| Demi-journée RTT ; pas de report ; expiry 1er juil. | p.38–48 |
| Cibles usage 70 % / 30 % (pas des crédits) | p.38–48 |
| Négatif RTT max 6 j (policy) | p.38–48 |
| Report CP max 5 j non cumulable ; exceptions non auto | p.38–48 |
| Spéciaux événementiels + justificatifs RH | p.45–47 |

## Règles nécessitant validation RH

- Temps partiel (pas de × % activité).
- Mois partiel d’emploi (pas de prorata inventé).
- RTT cadre sans calendrier validé.
- Horaires ≠ 39 h/sem.
- Arrondi fin de période CP (exemple 10,4→11) — opt-in uniquement.
- Exceptions de report > 5 j (partenaire + plan 31/12).
- Plafonds spéciaux `hypothese_demo`.

## Fichiers principaux

- `prisma/schema.prisma` + `prisma/migrations/20261110030000_entitlement_engine/`
- `src/domain/types/entitlement.ts`
- `src/domain/rules/entitlement-policies.ts`, `entitlement-accrual.ts` (+ tests)
- `src/application/services/entitlement-service.ts` (+ tests)
- `src/app/actions/entitlement.ts`
- `src/app/(app)/administration/droits-conges/page.tsx`
- `docs/LEAVE_LEDGER.md`, `docs/ENTITLEMENT_ENGINE.md`, `docs/HR_REQUIREMENTS.md`, `docs/ARCHITECTURE.md`

## Dépendances

Aucune dépendance npm ajoutée.

## Migrations

- Migration **additive** créée : `20261110030000_entitlement_engine`.
- **Non exécutée** depuis le poste local sur Production.
- Déploiement DB attendu via pipeline Vercel (`npm run build:vercel` / `docs/DEPLOYMENT.md`).

## Tests

```
npx vitest run entitlement-accrual.test.ts entitlement-service.test.ts leave-ledger-balance.test.ts leave-ledger-service.test.ts
→ 4 fichiers, 25 tests, OK
```

## Qualité

| Check | Résultat |
|-------|----------|
| `npm run typecheck` | OK |
| `npm run lint` | OK (0 erreur) |
| `ASTER_BUILD_WITHOUT_DB=1 npm run build` | OK |

## Limitations connues

- Lots d’accrual / reports / calendriers : store mémoire process (Prisma models prêts ; persistance batch Prisma à brancher en itération suivante).
- Formule RTT cadre (11 − fériés ouvrés, plancher 7) est **hr_configured** — à confirmer opérationnellement avec le calendrier réel du cabinet.
- Pas de posting automatique au deploy ; pas de paie / solde de tout compte.
- `docs/git ssh.txt` local non versionné volontairement.

## Prochaine étape recommandée

Brancher la persistance Prisma des `AccrualBatch` / `CarryoverRequest` / `OfficeWorkCalendar` (déjà en schéma), seed d’un calendrier bureau validé pour un site démo, puis UI collaborateur affichant CP acquis vs en acquisition séparément.
