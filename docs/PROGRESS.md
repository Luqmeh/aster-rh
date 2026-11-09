# ASTER — Progress report

Generated: 2026-11-09 (Phase 13 — Arrêts de travail & Absences spéciales)  
Branch: `main`  
Deployment status: **not claimed** — local checks passed; live Vercel employee→HR absence workflow not verified here.

## Context

A long-running subagent stalled after a temporary tool outage. Existing Phase 13 work on disk was preserved. Remaining gaps (reporting chart/export UI, tests, docs, PROGRESS, commit) were finished directly.

## Implemented features

- Module `WorkAbsence` distinct des CP/RTT : déclaration collaborateur (`/absences`), traitement RH (`/administration/absences`).
- Catégories arrêt + congés spéciaux (guide p.46) ; barème configurable avec revue RH si plafond ambigu.
- Workflow statuts : Déclaré → En attente de justificatif → … → Enregistré / Terminé / Refusé.
- Justificatifs privés `employee-absence-documents/…` ; Chef sans accès médical ; RH avec notes internes.
- Prolongation liée + flag écart ; rechute liée + flag < 3 mois ; rappels 24 h / 48 h / cutoff paie j.20 ; visite reprise p.62.
- Calendrier privacy-aware ; reporting KPI/chart + export Excel `arrets_absences` sans certificats/notes.
- Migration Prisma `20261109040000_work_absences`.

## Files changed (principal)

- `prisma/schema.prisma` + migration
- `src/domain/rules/work-absence.ts`, `special-leave-entitlements.ts`, permissions
- `src/application/services/work-absence-service.ts`, calendar + reporting wiring
- `src/infrastructure/persistence/*`, `reporting/excel-exports.ts`
- UI `/absences`, `/administration/absences`, composants modules
- Docs : `ABSENCES.md`, HR_REQUIREMENTS, AUTHORIZATION, ARCHITECTURE, DEPLOYMENT, README, REPORTING, ROADMAP, PROGRESS

## Dependencies

Aucune nouvelle dépendance npm (réutilise `exceljs` / storage existants).

## Focused test results

```
vitest run work-absence*.test.ts permissions.test.ts reporting-service.test.ts
Test Files  4 passed
Tests       24 passed
```

## Typecheck / lint / build

| Check | Result |
|-------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `ASTER_BUILD_WITHOUT_DB=1 npm run build` | pass — routes `/absences`, `/administration/absences` présentes |

## Known / remaining issues

- Plafonds chiffrés congés spéciaux p.46 : hypothèses / revue RH — à aligner page à page quand le guide est saisi.
- Chef : vue opérationnelle sans `work_absence.manage` ni documents médicaux (conforme matrice).
- Pas d’ajustement automatique soldes RTT / titres-restaurant (volontaire).
- Smoke live Production non exécuté.
- `docs/git ssh.txt` reste non suivi (ne pas committer).

## Exact next recommended step

Déployer / attendre Vercel Production, migrer, puis tester le parcours Collaborateur → upload justificatif → traitement RH → calendrier/reporting ; confirmer qu’un Chef ne peut pas ouvrir un certificat.
