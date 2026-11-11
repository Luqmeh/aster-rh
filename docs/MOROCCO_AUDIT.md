# ASTER — Audit France → Maroc (nov. 2026)

Audit réalisé avant refactoring Morocco-first. Objectif : identifier les hypothèses françaises, leurs dépendances, et le traitement recommandé **sans suppression destructive**.

## 1. Classifications d’emploi

| Finding | Location | Relevant MA? | Treatment |
|---------|----------|--------------|-----------|
| Enum `cadre` / `non_cadre` | `prisma/schema.prisma`, `Employee.category`, seeds, tests | Non comme déterminant d’acquisition | Conserver valeurs historiques ; ajouter `non_applicable` ; **ne plus piloter les droits** |
| `defaultAnnualEntitlement(category)` RTT selon cadre | `src/domain/rules/leave.ts` | Non | Désactiver / remplacer par politique MA non auto-postée |
| RTT cadre 7–11 j via calendrier | `entitlement-policies.ts`, `entitlement-accrual.ts` | Non (hypothèse FR) | Désactiver politiques FR ; historique ledger intact |
| Heures 39 h/sem | seed, `STANDARD_WEEKLY_HOURS_REFERENCE` | Non (réf. légale MA souvent 44 h) | Remplacer la référence d’alerte ; marquer validation RH |

## 2. Congés / entitlement Phase 2

| Finding | Location | Relevant MA? | Treatment |
|---------|----------|--------------|-----------|
| CP 2,08 j/mois, juin→mai, 5 semaines | `entitlement-policies.ts`, engine, docs | Non (guide FR) | **Désactiver** versions FR (`jurisdiction=FR`, `effectiveTo`) ; ne pas poster |
| Comptes `conges_payes_*` / `rtt` | ledger Phase 1–2 | Comptes techniques réutilisables | Garder ledger ; sémantique MA sur **nouvelles** politiques uniquement |
| RTT non-cadre 11 j, expiry 1er juil. | policies + service | Non | Désactiver ; pas d’acquisition RTT MA automatique |
| Spéciaux p.45–47 guide FR | `special-leave-entitlements.ts` | Partiellement (événements) | Marquer `à valider RH` ; plafonds non statutaires MA |
| Ouvertures LeaveBalance CP/RTT démo | `demo-seed.ts` | Démo seulement | Recaler labels / soldes démo MA ; **ne pas réécrire** ledger prod |

## 3. Calendrier / fuseau

| Finding | Location | Relevant MA? | Treatment |
|---------|----------|--------------|-----------|
| Calendrier Maroc déjà présent | `src/data/morocco-holidays.ts` | Oui | Conserver ; timezone `Africa/Casablanca` explicite |
| Fêtes lunaires `provisional` | idem | Oui | Conserver statut provisoire |
| Sites Paris / Lyon démo | `demo-seed.ts` | Non | Remplacer par sites démo Maroc clairement fictifs |

## 4. Télétravail

| Finding | Location | Relevant MA? | Treatment |
|---------|----------|--------------|-----------|
| 12 j/mois + 80 % (guide FR p.106) | `telework-monthly.ts`, `HR_REQUIREMENTS.md` | Non comme loi MA | Traiter comme **politique produit paramétrable** (alignée présentation Conseil) jusqu’à validation MA |
| Max 2 j/semaine | idem + présentation | Politique produit | Conserver paramétrable |

## 5. Organisation / démo

| Finding | Location | Relevant MA? | Treatment |
|---------|----------|--------------|-----------|
| Départements Direction, Audit, Conseil, Expertise, RH, SI | `demo-seed.ts` | Candidats (présentation) | Garder comme **démo configurable** |
| Identités FR (Léa Dubois, Paris…) | seed, DEMO_GUIDE | Non | Remplacer par personas démo Maroc fictifs |
| `weeklyContractHours: 39` | seed | Non | Référence démo 44 h (légal courant) + note validation |

## 6. Locale / monnaie

| Finding | Location | Relevant MA? | Treatment |
|---------|----------|--------------|-----------|
| `Africa/Casablanca` reporting | `reporting.ts` | Oui | Conserver / centraliser |
| Format `fr-FR` / pas de MAD | divers UI | Partiel | Introduire `fr-MA` + MAD |
| Mentions guide FR / PKF France | docs Phase 2 | Non | Documenter désactivation ; docs Morocco-* |

## 7. Permissions

| Finding | Location | Relevant MA? | Treatment |
|---------|----------|--------------|-----------|
| 3 rôles Chef / RH / Collaborateur | `permissions.ts`, Auth.js | Oui (produit) | **Conserver intact** |
| Médical RH-only | absences | Oui | Conserver |

## 8. Codes politiques Phase 2 FR (seed)

| Code | Statut post-refactor |
|------|----------------------|
| `CP_ACQUISITION_JUN_MAY` | Désactivé (`jurisdiction=FR`, non postable MA) |
| `RTT_NON_CADRE_JUL_JUN` | Désactivé |
| `RTT_CADRE_JUL_JUN` | Désactivé |
| `CP_CARRYOVER` | Désactivé (règles report MA à valider) |
| `RTT_EXPIRY_JULY_1` | Désactivé |
| `MA_ANNUAL_LEAVE_STATUTORY` | Ajouté, `requires_hr_decision`, **pas d’auto-post** |

## Principe

Les workflows produit (demandes, ledger, validations, reporting) restent. Les **valeurs juridiques FR** ne sont plus des défauts Maroc.
