# ASTER — Progress Report

**Date :** 11 novembre 2026  
**Branche :** `main`  
**Phase :** Ré-audit fidélité présentation Conseil (`ASTER_Presentation_Conseil_FR_v2.pptx`)

> Rapport généré à neuf (ancien fichier supprimé). Aucune modification des moteurs d’acquisition / légaux dans cette passe.

## 1. Implemented changes

Fidélité produit uniquement :

- Dashboard : raccourcis séparés « Demander un congé » vs « Déclarer une absence » ; télétravail 2/12 et documents (demande / dispo / historique).
- `/absences` : titre et description alignés sur la déclaration PPT (dates, catégorie, commentaire ; médicaux RH).
- Administration RH : **historique récent** congés/télétravail décidés ; copy récupération fériée = règle produit présentation Conseil.
- Rappel justificatifs sans formulation « paie ».
- Matrice slide-à-slide actualisée : `docs/PRESENTATION_ALIGNMENT.md`.

**Non modifié :** politiques CAP/RTT, ledger, migrations, accruals, télétravail 2/12 (déjà conformes).

## 2. Files modified

- `src/app/(app)/tableau-de-bord/page.tsx`
- `src/app/(app)/absences/page.tsx`
- `src/app/(app)/administration/page.tsx`
- `src/domain/rules/work-absence.ts`
- `docs/PRESENTATION_ALIGNMENT.md`
- ce rapport

## 3. Tests and validation results

| Check | Result |
|-------|--------|
| Vitest focused (permissions, approvals, work-absence, telework) — 33 | **PASS** |
| `tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` (offline) | **PASS** |

## 4. Known issues

- Captures PPT (sites FR / Cadre) vs données démo Maroc.
- Recrutement live vs « BIENTÔT » sur certaines captures.
- Plafonds télétravail configurables via env, pas via écran RH.
- « Droits à congés » hors script slides Conseil.

## 5. Outstanding policy decisions

Hors fidélité PPT — voir `docs/CALCULATION_POLICY_MATRIX.md` (CAP entreprise 2 j/mois, RTT, art. 235/239, régime légal férié).

## 6. Exact recommended next step

Exécuter le script de démo Conseil (Léa → Camille → Julien) sur l’instance déployée en suivant `docs/PRESENTATION_ALIGNMENT.md`, puis reprendre la confirmation RH des lignes « À valider » de la matrice de calcul — sans bulk accrual Production.
