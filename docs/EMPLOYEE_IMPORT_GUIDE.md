# Guide d'import RH — ASTER Maroc

Modèle unique : `assets/hr-import/ASTER_Modele_Import_RH_Maroc.xlsx`  
Régénération : `npx tsx scripts/build-hr-import-template.ts`

## Principes

- **Matricule** = identifiant métier stable (`Employee.id`). Texte (préserve les zéros non significatifs). Distinct du primary key technique Prisma / UserAccount.
- Pas de conversion silencieuse des colonnes obsolètes (`Identifiant` seul est aliasé vers Matricule ; `Poste`, `Département`, Site, cadre/non-cadre sont refusés).
- Contrat accepté : **CDI** et **Stage** uniquement.
- Grade : **Auditeur junior**, **Auditeur senior**, **Manager**.
- People Manager et Région : texte libre.

## Feuille Collaborateurs

### Contrôles Excel (prévention UX)

La validation Excel **ne remplace pas** la validation serveur.

| Champ | Saisie | Contrôle Excel |
|-------|--------|----------------|
| `Nom*`, `Prénom*` | **texte libre** | aucun dropdown |
| `Matricule*`, `E-mail`, `People Manager`, `Région*`, `Remarques RH` | texte libre | — |
| `Grade*` | liste (stricte) | `Auditeur junior`, `Auditeur senior`, `Manager` |
| `Type de contrat` | liste | `CDI`, `Stage` |
| `Statut*` | liste | `Actif`, `Suspendu`, `Sorti` |
| `Date d'embauche*`, `Date de sortie` | date Excel | type date |
| `Type de solde*` | liste | `CP`, `RTT`, `RECUPERATION_HEURES` |
| `Solde restant*` | nombre | décimal ≥ 0 |
| `Unité` | liste | `Jours`, `Heures` |
| `Date d'effet*` | date Excel | type date |
| `Vérification RH` | liste | `À vérifier`, `Vérifié par RH` |

**Retirés** : colonnes `Poste / fonction`, `Département` ; contrats `CDD`, `Alternance` ; listes `Autre` / `À préciser`.

### Collaborateurs — colonnes

| Colonne (en-tête modèle) | Obligatoire | Format / valeurs |
|--------------------------|-------------|------------------|
| `Matricule*` | oui | Matricule unique ASTER = `Employee.id` (texte) |
| `Nom*` | oui | **texte libre** |
| `Prénom*` | oui | **texte libre** |
| `E-mail professionnel` | recommandé | e-mail réel ; **absent** → fiche OK, compte en attente |
| `Grade*` | oui | `Auditeur junior`, `Auditeur senior`, `Manager` |
| `People Manager` | non | texte libre — résolu ou créé dans le catalogue ; aucune autorité d'approbation |
| `Région*` | oui | texte libre (aucune liste) |
| `Date d'embauche*` | oui | date Excel / `AAAA-MM-JJ` / `JJ/MM/AAAA` |
| `Type de contrat` | oui | `CDI`, `Stage` |
| `Statut*` | oui | `Actif`, `Suspendu`, `Sorti` (→ actif / inactif / parti) |
| `Date de sortie` | non | date Excel |
| `Remarques RH` | non | texte libre |

Sans e-mail, ASTER pose un marqueur technique `@no-mailbox.aster-rh.local` (pas de boîte mail, pas de compte).

### Soldes initiaux — format long

Une ligne = un couple `(matricule, type de solde)`.

| Colonne | Obligatoire | Format |
|---------|-------------|--------|
| `Matricule*` | oui | doit exister dans ASTER ou dans le lot |
| `Type de solde*` | oui | `CP`, `RTT`, `RECUPERATION_HEURES` |
| `Solde restant*` | oui | nombre ≥ 0 |
| `Unité` | recommandé | `Jours` / `Heures` |
| `Date d'effet*` | oui | date |
| `Source / fichier RH` | non | texte |
| `Référence source / onglet` | non | texte |
| `Vérification RH` | non | liste recommandée |
| `Remarques` | non | texte |

Le solde **RTT** n'est accepté que comme inventaire historique ; le solde calculé canonique Maroc est la **Récupération** (heures).

### Historique (optionnel)

| Colonne | Notes |
|---------|-------|
| `Matricule*` | obligatoire |
| `Type d'opération*` | liste |
| Dates / quantité / unité / statut | selon l'opération |
| Référence / Remarques | libres |

## Flux applicatif

1. Télécharger le modèle depuis Administration → Import RH.
2. Remplir Collaborateurs (+ Soldes / Historique si besoin).
3. Prévisualiser → corriger les erreurs → confirmer.
4. Réconciliation : créations, mises à jour, provisioning Collaborateur.

## Colonnes obsolètes

Toute présence de `Poste`, `Département`, `Site`, `Catégorie` (cadre/non-cadre) ou d'un contrat hors `CDI`/`Stage` produit une **erreur** d'import (pas de mapping silencieux).
