# ASTER — Progress Report

**Date :** 11 novembre 2026  
**Branche :** `main`  
**Phase :** 3 — Validation & moteur CAP statutaire Maroc (Loi 65-99)

> Rapport généré à neuf (ancien fichier supprimé). Ne constitue pas un avis juridique.

## 1. Rules verified and sources

| Rule | Source | Status |
|------|--------|--------|
| Art. 231 — 1,5 j / mois de service (adulte) ; 2 j (<18) | PDF Adala Code du travail, consolidé 26/10/2011 | Documenté & implémenté |
| Art. 231 — ouverture après 6 mois de service continu | Idem | Documenté & gate posting |
| Art. 232 — +1,5 j / 5 ans, plafond 30 j | Idem | Documenté & implémenté |
| Art. 233 — CDD : congé avant fin de contrat | Idem | Warning process RH |
| Art. 236–238 — jours effectifs / 26 ; 191 h non-agri / 208 h agri | Idem | Documenté & implémenté |
| Art. 240 — fractionnement / cumul 2 années par accord | Idem | Workflow admin, pas d’auto-post |
| URL officielle | https://adala.justice.gov.ma/api/uploads/2024/04/30/code%20du%20travail-1714463246806.pdf | Vérif. documentaire 11/11/2026 |

Aucun amendement post-2011 spécifique aux art. 231–245 n’a été identifié lors de la recherche du 11/11/2026 — **vigilance** requise.

## 2. Rules still awaiting HR / legal validation

- Art. 235 — extension de durée si fête/férié pendant le congé (consommation, pas accrual).
- Art. 239 — périodes assimilées à du travail effectif (mapping WorkAbsence).
- Week-end réel par site (ven–sam vs sam–dim) pour art. 236/238-1.
- Heures réelles / timesheet pour art. 238-2 temps partiel.
- Process CDD art. 233 + indemnité compensatrice (art. 251 s., hors paie ASTER).
- Registre des congés (art. 246).
- Confirmation cabinet qu’aucun texte ultérieur ne modifie art. 231–245.
- Avantage RTT employeur éventuel (pas de RTT statutaire MA).

## 3. Calculation changes

Moteur `src/domain/rules/morocco-annual-leave.ts` branché via `entitlement-accrual` / `entitlement-service` :

1. Taux art. 231 selon âge (`birthDate`) — défaut adulte + warning si naissance absente.
2. Annuel = `min(30, taux×12 + 1,5×⌊années/5⌋)` (art. 232).
3. Mois de service période (art. 238) : heures saisies / 191|208 ; sinon équivalence temps plein `weeklyContractHours` ; sinon jours effectifs / 26 ; temps partiel sans heures → non postable.
4. Crédit période = mois de service × (annuel / 12) — **pas** un simple `mois calendaires × 1,5`.
5. Posting auto seulement si politique MA `guide_documented`/`hr_configured`, statut `calculated`, ≥ 6 mois, quantité > 0.
6. Art. 240 : demande avec accord mutuel obligatoire ; posting manuel RH ; **pas** d’expiry FR / forfaiture auto.
7. Ledger append-only ; clés d’idempotence ; politiques FR inactives conservées historiquement.

## 4. Files and migrations changed

**Migration additive :** `prisma/migrations/20261111160000_ma_annual_leave_fields/`  
(`Employee.birthDate`, `Employee.activitySector`)

**Domain / application :**
- `src/domain/rules/morocco-annual-leave.ts` (+ tests)
- `src/domain/rules/entitlement-accrual.ts` (+ tests)
- `src/domain/rules/entitlement-policies.ts`
- `src/application/services/entitlement-service.ts` (+ tests)
- `src/app/actions/entitlement.ts`
- `src/app/(app)/administration/droits-conges/page.tsx`
- Types / seed / repos / mappers Prisma & démo

**Docs :** `docs/MOROCCO_HR_POLICY.md` (matrice), `docs/MOROCCO_MIGRATION.md`, ce rapport.

## 5. Test results

Focused Vitest (27 tests, 4 files) — **PASS** :

- `morocco-annual-leave.test.ts` (13)
- `entitlement-accrual.test.ts` (5)
- `entitlement-service.test.ts` (6)
- `leave-ledger-balance.test.ts` (3)

Couverture : art. 231/232/238, gate 6 mois, mineurs, TP sans heures, CDD warning, art. 240 accord, idempotence posting, rôles collaborateur/RH/Chef, conservation politiques FR inactives.

> Les tests ne prouvent pas à eux seuls la conformité juridique.

## 6. Typecheck / lint / build

| Check | Result |
|-------|--------|
| `tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` (`ASTER_BUILD_WITHOUT_DB=1`) | PASS |

## 7. Production status

- **Pas** de bulk accrual Production exécuté.
- **Pas** de seed démo activé.
- Migration additive uniquement — pipeline Vercel `build:vercel` / `prisma migrate deploy` inchangé.
- Historique ledger FR préservé (pas de rewrite / truncate).
- Cas ambigus (TP sans heures, < 6 mois, art. 239…) restent non postables automatiquement.

## 8. Remaining risks

1. PDF Adala consolidé 2011 — risque de texte postérieur non détecté.
2. Assimilation art. 239 et week-end site non branchés → sous/sur-mesure possible si RH poste sans contrôle.
3. Art. 235 non dans le moteur de consommation.
4. Heures période non issues d’un timesheet — saisie manuelle / validation RH requise pour TP.
5. Appréciation ancienneté « continue ou non » (art. 232) simplifiée via années depuis embauche.

## 9. Exact next recommended step

Faire valider la matrice `docs/MOROCCO_HR_POLICY.md` par RH / conseil juridique du cabinet (articles 235, 239, week-end site, timesheet), puis — seulement après validation écrite — autoriser un premier posting contrôlé d’un mois pilote (pas de bulk) sur un sous-ensemble d’employés à temps plein avec données d’emploi complètes.
