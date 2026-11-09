# Reporting RH & exports Excel

Route : `/administration/rapports`  
Accès : **Ressources humaines** et **Chef de projet** uniquement (`hr.reporting`).  
Les collaborateurs sont refusés côté serveur (redirection / `AuthError` sur export).

## Principes

- Données **uniquement** issues des modules déjà persistés (congés, télétravail, effectifs, recrutement, documents, travail férié / ledger).
- Pas de paie, pointage ni timesheet.
- Fuseau calendaire : **Africa/Casablanca**.
- Période max : 732 jours.
- KPI dashboard et exports partagent `parseReportingFilters` + les mêmes règles de classification de statut.
- Absences confirmées = demandes de congé **approuvées** uniquement (refus / en attente exclus).
- RTT annuels et récupération compensatrice restent **séparés**.
- Exports : pas de CV, URL signées, notes RH internes, hashes, mots de passe.

## Exports (`.xlsx` via exceljs)

| Clé | Libellé |
|-----|---------|
| `conges_mois` | Congés du mois |
| `planning_absences` | Planning des absences (approuvées) |
| `soldes` | Soldes CP / RTT / récupération |
| `teletravail` | Télétravail |
| `annuaire` | Annuaire / effectifs |
| `recrutement` | Recrutement |
| `documents` | Demandes de documents |
| `travail_ferie` | Travail férié & récupération |
| `lifecycle` | Onboarding & cycle de vie |
| `historique` | Historique congés / télétravail / férié |
| `arrets_absences` | Arrêts & absences spéciales (sans certificats / notes médicales) |

Chaque export journalise une notification « Export Excel reporting » pour l’acteur (piste d’audit légère en l’absence d’une table d’audit générique).

## Fichiers

- `src/domain/rules/reporting.ts` — presets, fuseau, KPI types
- `src/application/services/reporting-service.ts` — dashboard + orchestration export
- `src/infrastructure/reporting/excel-exports.ts` — feuilles Excel
- `src/app/actions/reporting.ts` — action serveur d’export
- `src/app/(app)/administration/rapports/page.tsx` — UI
