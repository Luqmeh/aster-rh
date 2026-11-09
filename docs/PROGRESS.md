# ASTER — Progress report

**Date :** 2026-11-09  
**Focus :** Jours fériés marocains + travail férié + récupération (ledger)  
**Statut :** Implémenté et poussé sur `main` — **parcours Production non vérifié**

## Fonctionnalités

### Calendrier fériés
- Dataset versionné `src/data/morocco-holidays.ts` (sources maroc.ma / MMSP) : nationaux fixes + religieux 2025–2027.
- Religieux 2026 **confirmés** ; 2027 **provisoires** (vue du croissant).
- Overrides RH (`HolidayOverride`) pour corriger / ajouter un jour entreprise (dédoublonnage `sourceKey+year`).
- Affichage calendrier avec tons distincts (confirmé / provisoire) — **aucune** création auto de congé ou crédit.

### Travail un jour férié
- Demande collaborateur depuis une entrée férié (heures planifiées, créneaux, justification).
- Uniquement sur un férié réel ; une seule demande active / collaborateur / date.
- Statuts : En attente → Approuvée / Refusée → Travail effectué — à confirmer → Confirmée — récupération créditée.
- Approbation **avant** le jour férié ; déclaration des heures **après** ; confirmation Chef uniquement.

### Crédit récupération (règle produit ASTER)
- **1 h confirmée = 1 h créditée** (conversion jours via `Employee.standardDailyHours`, défaut 7).
- Ledger auditable `RecoveryCreditLedger` — pas d’écrasement silencieux du solde RTT annuel.
- Champs `recoveryDays*` sur `LeaveBalance` ; type d’absence `recuperation` pour consommer via le flux congés existant.
- **Non** présenté comme politique guide PKF ; indépendant BEEYE/AGIRIS.

### Droits
- Chef : approuver / confirmer / créditer (global).
- RH : lecture file + overrides fériés — **pas** d’approbation.
- Collaborateur : soi uniquement.

## Fichiers principaux

| Zone | Fichiers |
|------|----------|
| Data | `morocco-holidays.ts` |
| Domaine | `morocco-holidays.ts`, `work-on-holiday.ts`, permissions, leave, calendar |
| App | `work-on-holiday-service.ts`, `calendar-service.ts` |
| Prisma | migration `20261109030000_work_on_holiday_recovery` |
| UI | calendrier + forms, administration (file lecture + override) |
| Docs | HR_REQUIREMENTS, AUTHORIZATION_MATRIX, ARCHITECTURE, README, PROGRESS |

## Dépendances

Aucune nouvelle dépendance npm.

## Tests

```
npx vitest run src/application/services/work-on-holiday-service.test.ts \
  src/domain/rules/morocco-holidays.test.ts
→ 8 passed
```

(+ calendar-events / leave fixtures alignés)

## Typecheck / lint / build

| Check | Résultat |
|-------|----------|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK (session précédente + typecheck/lint frais) |

## Issues restantes

- Vérifier migrate Production (`WorkOnHoliday*`, `HolidayOverride`, `RecoveryCreditLedger`, enum `recuperation`).
- UI calendrier : heures planifiées affichées en dur (7) sur certaines actions — le service utilise la valeur réelle en base.
- Pas de feed API externe : maintenance manuelle du dataset + overrides RH.
- **E2E Production non exécuté.**

## Prochaine étape exacte

1. Attendre le déploiement Vercel + migrate.
2. Ouvrir `/calendrier` → vérifier fériés (ex. 18/11 confirmé).
3. Collaborateur : demander travail sur un férié **futur** → Chef approuve → après la date, déclarer heures → Chef confirme → solde `recuperation` crédité.
4. RH : contrôler la file lecture seule et un override de date.
