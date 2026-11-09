# ASTER — Progress report

Generated: 2026-11-09 (Phase 12 — HR Reporting & Excel Exports)  
Branch: `main`  
Deployment status: **not claimed** — code pushed after local checks; live Vercel dashboard/exports not verified in this report.

## Implemented features (this phase)

- Route `/administration/rapports` — dashboard Reporting RH (FR, design enterprise light).
- Filtres période (Ce mois / Mois précédent / Ce trimestre / Cette année / Personnalisé) + département, collaborateur, statut cycle de vie, statut demande.
- KPI DB-backed : effectif actif, embauches, départs, inactifs, demandes congés, jours d’absences **approuvées**, demandes en attente, télétravail, documents en attente, recrutements ouverts, récupération créditée (ledger).
- Graphiques (barres) : effectif par département, absences / télétravail par mois, statuts congés / recrutement / documents — états vides explicites.
- Centre d’exports Excel `.xlsx` (exceljs) : Congés, Planning absences, Soldes CP/RTT/récupération séparés, Télétravail, Annuaire, Recrutement, Documents, Travail férié, Lifecycle, Historique consolidé.
- Auth serveur `hr.reporting` pour RH + Chef ; Collaborateur refusé (UI + actions).
- Fuseau Africa/Casablanca ; plafond période 732 jours ; notification d’audit légère par export.
- Exclusion systématique CV / URLs / notes RH / secrets des exports.

## Files changed (principal)

- `src/domain/rules/reporting.ts` (+ tests)
- `src/domain/rules/permissions.ts` (`hr.reporting`)
- `src/application/services/reporting-service.ts` (+ tests)
- `src/infrastructure/reporting/excel-workbook.ts`
- `src/infrastructure/reporting/excel-exports.ts`
- `src/app/actions/reporting.ts`
- `src/app/(app)/administration/rapports/page.tsx`
- `src/components/modules/reporting-*.tsx`
- `src/lib/navigation.ts`, `src/app/(app)/administration/page.tsx`
- Docs : `README.md`, `ARCHITECTURE.md`, `AUTHORIZATION_MATRIX.md`, `ROADMAP.md`, `REPORTING.md`, `PROGRESS.md`
- Dépendance : `exceljs`

## Focused test results

```
vitest run reporting.test.ts reporting-service.test.ts permissions.test.ts
Test Files  3 passed
Tests       18 passed
```

Couverture : presets/Casablanca, auth RH/Chef/Collaborateur, refus ≠ absences, filtre département, soldes RTT vs récupération, headers Excel, champs sensibles exclus, cohérence planning/KPI.

## Typecheck / lint / build

| Check | Result |
|-------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 warnings after cleanup) |
| `ASTER_BUILD_WITHOUT_DB=1 npm run build` | pass — route `/administration/rapports` présente |

## Known / remaining issues

- Pas de table d’audit générique : exports journalisés via notification acteur.
- Dates de décision congés/télétravail dérivées de `updatedAt` (pas de champ dédié en schéma).
- Attribution mensuelle des jours d’absence : mois de `startDate` (pas de répartition jour par jour multi-mois).
- Déploiement Production / smoke live non exécuté dans ce cycle.
- Modules non couverts volontairement : paie, pointage, timesheet, frais, formation.

## Exact next recommended step

Sur Vercel Production : ouvrir `/administration/rapports` avec un compte RH et un compte Chef, vérifier KPI + un export Excel ; confirmer qu’un Collaborateur est redirigé. Ensuite enchaîner sur l’affinage UX démo (ROADMAP Phase 0) ou CI automatisée (Phase 1).
