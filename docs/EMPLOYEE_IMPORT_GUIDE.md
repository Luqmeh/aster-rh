# Guide d'import Excel — Collaborateurs et soldes d'ouverture (Maroc)

Migration contrôlée des effectifs et soldes vérifiés depuis Excel vers ASTER.
Réservé au département Maroc. Pas de paie, CNSS, ni activation automatique d'acquisition.

## Accès

| Rôle | Droits |
|------|--------|
| `admin_rh` | Préparer, valider, prévisualiser, confirmer, exécuter, récupérer un lot interrompu, reprovisionner un compte collaborateur |
| `chef_de_projet` | Consulter lots / rapports persistés (pas d'exécution) |
| `collaborateur` | Aucun accès |

Parcours UI : **Administration → Import des collaborateurs** (`/administration/import-collaborateurs`).
Contrôles serveur : `hr.import.view` / `hr.import.execute` (+ `employee.provision` pour les comptes).

## Modèle Excel officiel (unique)

ASTER ne propose **qu'un seul** fichier téléchargeable :

`ASTER_Modele_Import_RH_Maroc.xlsx`  
(asset repo : `assets/hr-import/ASTER_Modele_Import_RH_Maroc.xlsx`, SHA-256 `e0b2bcb8137ab3c0c584d5cb1cd243546bd1a645996805831110be1a92f42ccd`)

Régénération des listes / validations Excel : `npm run build:hr-import-template` (source de vérité : `src/domain/rules/hr-import/accepted-values.ts`).

Ne pas renommer les feuilles ni les en-têtes. Taille max : **5 Mo** (`.xlsx`).

### Feuilles

| Feuille | Rôle |
|---------|------|
| `Lisez-moi` | Instructions (ignorée à l'import) |
| `Collaborateurs` | Fiches collaborateurs |
| `Soldes initiaux` | Soldes d'ouverture (format **long**) |
| `Historique optionnel` | Structure future — **non exécuté** |
| `Listes` | Sources des listes déroulantes Excel (feuille **masquée**, ignorée à l'import) |

Les en-têtes de données sont en **ligne 4** ; les premières lignes de données commencent à la ligne 5 (plage validée jusqu'à la ligne 204). Les lignes vides restent autorisées (`allowBlank`).

### Contrôles Excel (prévention UX)

La validation Excel **ne remplace pas** la validation serveur.

| Champ | Saisie | Contrôle Excel |
|-------|--------|----------------|
| `Nom*`, `Prénom*` | **texte libre** | aucun dropdown |
| `Matricule*`, `E-mail`, `Poste / fonction`, `Matricule du responsable`, `Remarques*` | texte libre | — |
| `Département` | liste | `DIR`, `RH`, `AUD`, `CNS`, `EXP`, `SI` |
| `Site` | liste (avertissement si hors liste) | sites seed démo |
| `Type de contrat` | liste | `CDI`, `CDD`, `Alternance`, `Stage` |
| `Statut*` | liste | `Actif`, `Suspendu`, `Sorti` |
| `Date d'embauche*`, `Date de sortie` | date Excel | type date |
| `Type de solde*` | liste | `CP`, `RTT`, `RECUPERATION_HEURES` |
| `Solde restant*` | nombre | décimal ≥ 0 |
| `Unité` | liste | `Jours`, `Heures` |
| `Date d'effet*` | date Excel | type date |
| `Vérification RH` | liste | `À vérifier`, `Vérifié par RH` |

**Retirés des listes** (refusés par l'importateur) : `Autre`, `À préciser` pour le type de contrat.

### Collaborateurs — colonnes

| Colonne (en-tête modèle) | Obligatoire | Format / valeurs |
|--------------------------|-------------|------------------|
| `Matricule*` | oui | Identifiant unique ASTER (texte) |
| `Nom*` | oui | **texte libre** |
| `Prénom*` | oui | **texte libre** |
| `E-mail professionnel` | recommandé | e-mail réel ; **absent** → fiche OK, compte en attente |
| `Département` | oui | code liste (`AUD`, `RH`…) ou libellé mappable |
| `Poste / fonction` | oui | texte libre |
| `Site` | oui | liste + nouveaux sites possibles (avertissement serveur) |
| `Date d'embauche*` | oui | date Excel / `AAAA-MM-JJ` / `JJ/MM/AAAA` |
| `Type de contrat` | oui | `CDI`, `CDD`, `Alternance`, `Stage` |
| `Statut*` | oui | `Actif`, `Suspendu`, `Sorti` (→ actif / inactif / parti) |
| `Matricule du responsable` | non | matricule existant ou présent dans le lot |
| `Date de sortie` | non | date Excel |
| `Remarques RH` | non | texte libre |

Sans e-mail, ASTER pose un marqueur technique `@no-mailbox.aster-rh.local` (pas de boîte mail, pas de compte).

### Soldes initiaux — format long

Une ligne = un couple `(matricule, type de solde)`.

| Colonne | Obligatoire | Format |
|---------|-------------|--------|
| `Matricule*` | oui | doit exister dans ASTER ou dans le lot |
| `Type de solde*` | oui | `CP`, `RTT`, `RECUPERATION_HEURES` |
| `Solde restant*` | oui | décimal ≥ 0 (virgule ou point) |
| `Unité` | oui | `Jours` pour CP/RTT ; `Heures` pour `RECUPERATION_HEURES` |
| `Date d'effet*` | oui | date Excel |
| `Source / fichier RH` | recommandé | audit (texte) |
| `Référence source / onglet` | non | audit (texte) |
| `Vérification RH` | recommandé | `À vérifier` / `Vérifié par RH` |
| `Remarques` | non | texte |

**Important :** `RECUPERATION_HEURES` est stockée en **heures** dans le ledger (`unit: "hours"`). Aucune conversion silencieuse en jours.

Doublons `(matricule, type)` dans le fichier → erreur de validation.

## Persistance durable des lots

Chaque lot est enregistré en base PostgreSQL (`HrImportBatch`) lorsque `ASTER_PERSISTENCE=prisma` / `DATABASE_URL` est présent ; en mode mémoire de démo, les lots vivent dans le store démo.

Les classeurs ne sont **jamais** exposés publiquement (`imports/private/...`). Après exécution réussie, le cache local du fichier est purgé ; le rapport reste persisté.

### Cycle de vie

`uploaded` → `validating` → `awaiting_confirmation` → `executing` → `completed` | `completed_with_errors` | `failed`

- Claim atomique avant exécution : empêche les doubles lancements concurrents.
- `completed` / `completed_with_errors` : réexécution refusée.
- Lot bloqué en `executing` : récupération manuelle RH → `failed`.
- Depuis `failed` : nouvelle confirmation `IMPORTER` possible ; créations / ouvertures / comptes restent idempotentes.

## Workflow

1. Télécharger le modèle officiel unique.
2. Remplir **Collaborateurs** et **Soldes initiaux** (sans inventer d'e-mails ni de mots de passe ; sans rôles RH/Chef dans le fichier).
3. Téléverser le `.xlsx`.
4. Prévisualiser et corriger / **Remplacer le fichier** si besoin.
5. Option : **Mettre à jour les fiches existantes**.
6. Décision RH :
   - **Confirmer l'import** (phrase `IMPORTER`) — exécute créations / soldes / comptes.
   - **Abandonner l'import** — dialogue de confirmation ; lot → `cancelled` ; aucun collaborateur, compte ni solde créé ; classeur temporaire purgé ; audit conservé.
7. Consulter le rapport persisté (réconciliation + provisioning comptes) ou l'historique des lots.

Un lot `cancelled`, `completed` ou `completed_with_errors` ne peut plus être exécuté. Un lot `executing` ne peut pas être abandonné (récupération → `failed` d'abord).

## Provisioning des comptes ASTER

| Situation | Résultat |
|-----------|----------|
| E-mail pro valide, pas de compte | Compte `collaborateur` créé, `mustChangePassword=true`, mot de passe temporaire **envoyé par e-mail uniquement** |
| Compte déjà lié | `already_existing` — credentials non écrasés |
| E-mail absent | `pending` — fiche créée, pas de compte |
| Échec technique | `failed` — visible dans le rapport |

Le fichier Excel **ne peut pas** attribuer `admin_rh` ni `chef_de_projet`.

## Soldes d'ouverture (ledger)

Écritures append-only :

- `transactionType` = `opening_balance`
- `sourceKind` = `hr_excel_import_opening`
- `sourceId` = `{batchId}:{matricule}:{account}`

Pas de recalcul d'acquisition, pas d'écrasement d'ouvertures existantes.

## Parseur

Le modèle officiel (commentaires Excel + tables) n'est **pas** lu via ExcelJS. ASTER utilise un parseur OOXML (JSZip) dédié (`ooxml-workbook.ts`).

## Réconciliation

Rapport persisté : lot, date, auteur, créations / mises à jour, soldes, comptes (créés / existants / pending / failed), rejets, avertissements, interventions manuelles, comparaison Excel ↔ ASTER par matricule. Téléchargement Excel du rapport disponible pour RH et Chef.

## Vérification E2E

`npm run test:e2e` lance Playwright (mémoire isolée, port 3111) : login `admin_rh` → téléchargement (hash SHA-256) → upload d'un classeur rempli → `IMPORTER` → asserts UI + inspect magasin (`ASTER_E2E_INSPECT=1`).
