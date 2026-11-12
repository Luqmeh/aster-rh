# ASTER — Rapport de progression

**Date / heure :** 12 novembre 2026  
**Branche :** `main`  
**Sujet :** Refactor structure collaborateur (Grade / People Manager / Région) + nettoyage RTT/Récupération + alignement import Excel  
**État :** **FAIT** — Vitest 335✓ / tsc / lint / build OK ; commit + push `origin/main`.

---

## Champs retirés / introduits

| Retiré (UI / contrat actif) | Introduit |
|-----------------------------|-----------|
| Catégorie cadre / non-cadre | **Grade** (`auditeur_junior` \| `auditeur_senior` \| `manager`) — libellés FR exacts |
| Manager hiérarchique | **People Manager** (catalogue + affectation) |
| Site | **Région** (texte libre) |

Grade = classification organisationnelle uniquement (pas de soldes / permissions / approbation).  
People Manager n’accorde aucune autorité d’approbation.

## Schéma DB / migration

- Enum `EmployeeGrade` ; modèle `PeopleManager` ; `Employee.grade`, `Employee.region`, `Employee.peopleManagerId`.
- Colonnes legacy `site` / `category` / `managerId` conservées (sync / historique) — non lues comme source de vérité applicative.
- Migration : `prisma/migrations/20261112010000_employee_grade_people_manager_region/`.
  - `region` ← copie de `site` (Pas de mapping toponymique).
  - `grade` ← rôles `chef_de_projet`/`admin_rh` → `manager` ; sinon heuristique cadre→senior / non_cadre→junior / défaut senior.
  - People Manager créés depuis `managerId` existants (`pm-from-<id>`).

## People Manager

- CRUD catalogue : RH (`admin_rh`) + Senior Manager (`chef_de_projet`).
- Entrée manuelle (nom) et/ou `linkedEmployeeId` ; pas de provisioning de compte automatique.
- Affectation onboarding / édition fiche ; affichage profil + annuaire.
- Import : texte libre → résolution / création catalogue.

## Grade / Région — validation

- Centralisé : `src/domain/types/employee-structure.ts` (`parseEmployeeGrade`, `parseRegion`).
- Cadre / non-cadre refusés sans mapping silencieux.
- Région : trim, 1–120 car., aucune liste prédéfinie.
- Excel dropdown Grade = mêmes libellés que le schéma Zod / parseur.

## RTT / Récupération — décision

- **Conservé (canonique) :** Récupération (`LeaveType.recuperation` + `recoveryDays*` + `RecoveryCreditLedger` + workflow férié travaillé).
- **Déprécié UI :** RTT retiré des types de demande collaborateur (`ACTIVE_LEAVE_REQUEST_TYPES`) et des compteurs tableau de bord / `/conges` (affichage « Récupération restants » uniquement).
- Ledger / colonnes `rtt*` et enum `LeaveType.rtt` **préservés** (historique / import soldes) — aucun reset, aucun nouvel accrual auto au déploiement.
- Motif : seul le flux récupération est piloté par un moteur de calcul MA (WOH) ; RTT MA entitlement = 0 / héritage FR.

## Import Excel

- Modèle : `assets/hr-import/ASTER_Modele_Import_RH_Maroc.xlsx`  
  SHA-256 : `bfd5b0bb7bf00b78c8589d290e39761c421fdad851fb56accb4e86ffa2a0fe6f` (zip déterministe via `scripts/build-hr-import-template.ts`).
- Colonnes Collaborateurs : Grade*, People Manager, Région* (Site / Catégorie / Matricule responsable refusés).
- Feuille Listes : Grade (plus Site).
- Validate + exécution : `grade` / `region` / People Manager persistés.

## Fichiers principaux

- Domain : `employee-structure.ts`, `people-manager.ts`, `active-leave-types.ts`, `hr-import/*`
- Prisma : `schema.prisma` + migration `20261112010000_*`
- Services : `employee-provisioning-service`, `employee-service`, `people-manager-service`, `hr-import-service`
- UI : onboard / HR form / annuaire / profil / leave-form / dashboards
- Docs : `HR_REQUIREMENTS.md`, `EMPLOYEE_IMPORT_GUIDE.md`, `LEAVE_LEDGER.md`, ce rapport
- Asset : modèle Excel régénéré

## Dépendances

Aucune dépendance npm ajoutée.

## Tests / qualité

| Contrôle | Résultat |
|----------|----------|
| Vitest | **335 passed**, 1 skipped |
| `tsc --noEmit` | OK |
| `eslint` | OK |
| `ASTER_BUILD_WITHOUT_DB=1 npm run build` | OK |

## Production safety

- Aucun seed / truncate exécuté contre Production.
- Migration non destructive (backfill Amel/Kenza : region depuis site ; grade Manager si rôles RH/Chef).
- Pas de génération d’écritures ledger à l’import de schéma.
- Ne pas toucher `docs/git ssh.txt`.

## Known issues / remaining

- Colonnes Prisma legacy `site`/`category` encore présentes (sync) — nettoyage drop ultérieur possible après observation Production.
- Politiques FR RTT dans `entitlement-policies` restent documentées historique (non auto-postées MA).
- Feuille Lisez-moi du modèle Excel : mise à jour (Grade / People Manager / Région ; RTT = historique).

## Exact next step

1. Déployer Vercel Production (`migrate deploy` via `build:vercel`) pour appliquer `20261112010000_*`.  
2. Vérifier Amel DAAB + KENZA RAFIQ : Grade / Région / People Manager.  
3. Télécharger le nouveau modèle Excel et faire un dry-run import sur Preview.
