# PROGRESS — Employee Form Cleanup & Matricule Standardization

**Date :** 2026-11-12  
**Branche :** `main`  
**Statut :** terminé — Vitest / tsc / lint / build OK

## Matricule — terminologie et implémentation

- Libellé UI / import / exports : **Matricule** (remplace Identifiant collaborateur).
- Valeur = `Employee.id` (identifiant métier stable).
- Aucune régénération de matricules ; pas de rename de PK ; UserAccount inchangé.
- Colonne DB inchangée (`id`) — exposition applicative uniquement.
- Alias import `Identifiant` → `matricule` conservé ; pas de confusion avec UserAccount.
- Excel : Matricule en texte (préserve les zéros non significatifs).

## Champs retirés

| Champ | Traitement |
|-------|------------|
| **Poste** (`jobTitle`) | Retiré des formulaires, profils, annuaire, import. Colonne DB legacy, défaut `''`, toujours vide en écriture. |
| **Département employé** (`departmentId`) | Retiré des fiches collaborateur. Nullable + `ON DELETE SET NULL`. `OrganizationUnit` conservé pour le recrutement. |

## Contrats retenus

- Écriture / UI / Excel / validation serveur : **CDI**, **Stage** uniquement (`parseEmployeeContract`).
- Enum Prisma `cdd` / `alternance` conservée pour lectures historiques (`StoredContractType`).
- CDD / Alternance rejetés à l’onboarding, édition, import.

## Migration base

- Fichier : `prisma/migrations/20261112020000_employee_form_cleanup/migration.sql`
- Non destructive : `jobTitle` DEFAULT `''` ; `departmentId` DROP NOT NULL ; FK `SET NULL`.
- Pas de reset Production, pas de seed, pas de suppression Amel DAAB / KENZA RAFIQ.
- Pipeline Vercel (`build:vercel` / migrate deploy) inchangé.

## Import Excel

- Modèle : `assets/hr-import/ASTER_Modele_Import_RH_Maroc.xlsx`
- SHA-256 : `88672aa999a017a008d724bbce3fe624c3f3ecc5821b4617a199730b51ef1145`
- Colonnes Collaborateurs (12) : Matricule*, Nom*, Prénom*, E-mail, Grade*, People Manager, Région*, Date d'embauche*, Type de contrat, Statut*, Date de sortie, Remarques RH
- Listes : Contrat = CDI|Stage ; Grade = Auditeur junior|Auditeur senior|Manager ; plus de liste Départements
- Poste / Département / Site / cadre refusés sans mapping silencieux
- Régénération : `npx tsx scripts/build-hr-import-template.ts`

## Tests et résultats

| Contrôle | Résultat |
|----------|----------|
| Vitest | **342 passed**, 1 skipped (64 fichiers) |
| `tsc --noEmit` | OK |
| `npm run lint` | OK |
| `ASTER_BUILD_WITHOUT_DB=1 npm run build` | OK |

Couverture clé : `employee-structure`, import validate / workbook / service, provisioning, document CNCC (grade Manager), employee-service RH.

## Problèmes connus

- Filtre reporting « Département » reste pour le recrutement / unités org ; les fiches employé n’exposent plus ce champ (export annuaire / congés utilisent Matricule / Région).
- CNCC : hypothèse démo basculée de Poste→Grade Manager (à confirmer RH).
- Valeurs contrat legacy éventuelles en lecture seule jusqu’à migration métier manuelle.

## Prochaine étape exacte

Déployer sur Vercel Production (migrate non destructive via `build:vercel`) puis vérifier onboarding + téléchargement modèle import (headers Matricule, Contrat CDI/Stage) sans toucher aux deux comptes existants.
