# ASTER — Progress Report

**Date :** 11 novembre 2026  
**Branche :** `main`  
**Phase :** Alignement fidélité présentation Conseil (`ASTER_Presentation_Conseil_FR_v2.pptx`)

> Rapport généré à neuf (ancien fichier supprimé). Aucune refonte des calculs d’acquisition légaux dans cette phase.

## 1. Implemented changes

Fidélité produit uniquement (terminologie, navigation, séparation des parcours, gouvernance affichée) :

- Navigation : « Congés et absences », « Recrutement / entretiens » (libellés PPT).
- Statuts UI : `en_attente_rh` affiché « En attente de validation » (plus « En attente RH »).
- Congés : libellés « Congés payés » / « RTT » ; demi-journées conservées ; **maladie retirée** du formulaire → lien vers `/absences`.
- Compteur « Catégorie cadre » remplacé par **Récupération restants** sur `/conges`.
- Télétravail : message règles produit **2 j/semaine · 12 j/mois** (paramétrables) sans primauté « guide p.106 ».
- Profil / annuaire : plus de badge Cadre/Non-cadre forcé si `non_applicable`.
- Modules non opérationnels : rémunération / temps de travail sans promesse paie ou cadre FR.
- Administration RH : lien explicite Reporting pour historiques ; RH sans boutons de décision.
- Docs : `PRESENTATION_ALIGNMENT.md`, `ASTER_SCOPE.md`, correction `HR_REQUIREMENTS.md` (RH sans validation managériale).

**Non modifié :** moteur CAP Maroc, ledger append-only, accruals, migrations, seed Production.

## 2. Files modified

- `src/lib/navigation.ts`
- `src/domain/rules/approvals.ts`, `leave.ts`
- `src/domain/types/hr.ts` (commentaires)
- `src/components/modules/leave-form.tsx`, `monthly-telework-planner.tsx`, `reporting-filters.tsx`
- `src/app/(app)/conges/page.tsx`, `teletravail/page.tsx`, `profil/page.tsx`, `annuaire/[id]/page.tsx`, `administration/page.tsx`, `remuneration/page.tsx`, `temps-de-travail/page.tsx`
- `docs/PRESENTATION_ALIGNMENT.md` (nouveau), `ASTER_SCOPE.md`, `HR_REQUIREMENTS.md`, ce rapport

## 3. Tests and validation results

| Check | Result |
|-------|--------|
| Vitest focused (permissions, approvals, leave, telework-monthly) — 33 tests | **PASS** |
| `tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` (`ASTER_BUILD_WITHOUT_DB=1`) | **PASS** |

## 4. Known issues

- Captures PPT avec sites FR / badge Cadre vs données démo Maroc actuelles.
- Recrutement opérationnel alors que certaines captures le marquent « BIENTÔT » (slide 13 ne le classe pas hors périmètre).
- Pas d’UI de configuration des plafonds télétravail (règles hardcodées 2/12).
- Historique RH congés/télétravail principalement via Reporting, pas une liste dédiée Administration.
- Compteur RTT affiché (fidélité PPT) sans règle d’acquisition Maroc spécifiée dans la présentation.

## 5. Outstanding policy decisions

- Origine / alimentation du solde RTT Maroc (avantage employeur ? historique ?).
- Paramétrage RH des plafonds télétravail (au-delà des 2/12 démontrés).
- Liste complète des types « Congés et absences » vs catalogue Arrêts.
- Traitement des écrans Recrutement dans le script de démo Conseil.
- Toute règle de calcul non écrite dans le PPT (voir `PRESENTATION_ALIGNMENT.md` §3) — à valider avant phase calcul/légal.

## 6. Exact recommended next step

Valider avec le métier le **script de démonstration Conseil** (parcours Léa → Camille → Julien) sur l’instance déployée, en s’appuyant sur `docs/PRESENTATION_ALIGNMENT.md`, puis ouvrir une phase **séparée** de calculs/politiques uniquement pour les écarts de soldes explicitement listés au §3 (RTT, récupération, CAP) avec sources écrites — sans modifier le ledger historique.
