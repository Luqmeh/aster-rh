# Guide d'import Excel — Collaborateurs et soldes d'ouverture (Maroc)

Migration contrôlée des effectifs et soldes vérifiés depuis Excel vers ASTER.
Réservé au département Maroc. Pas de paie, CNSS, ni activation automatique d'acquisition.

## Accès

| Rôle | Droits |
|------|--------|
| `admin_rh` | Préparer, valider, prévisualiser, confirmer et exécuter |
| `chef_de_projet` | Consulter lots / rapports (pas d'exécution) |
| `collaborateur` | Aucun accès |

Parcours UI : **Administration → Import des collaborateurs** (`/administration/import-collaborateurs`).
Les contrôles d'autorisation sont appliqués côté serveur (`hr.import.view` / `hr.import.execute`).

## Modèles Excel

Téléchargeables depuis l'assistant (fichiers `.xlsx`, max 5 Mo).

### Template A — Collaborateurs

| Colonne | Obligatoire | Format / valeurs |
|---------|-------------|------------------|
| `matricule` | oui | Identifiant unique ASTER |
| `prenom` | oui | texte |
| `nom` | oui | texte |
| `email_professionnel` | oui | e-mail réel fourni par RH (jamais inventé) |
| `departement` | oui | code (`AUD`, `RH`…) ou libellé ; mappable |
| `poste` | oui | texte |
| `site` | oui | texte ; mappable ; site inconnu → avertissement |
| `date_embauche` | oui | `AAAA-MM-JJ` ou `JJ/MM/AAAA` |
| `type_contrat` | oui | `cdi`, `cdd`, `alternance`, `stage` |
| `statut_emploi` | oui | `actif`, `inactif`, `parti` (défaut `actif` si vide) |
| `matricule_manager` | non | matricule existant ou présent dans le lot |

### Template B — Soldes d'ouverture

| Colonne | Obligatoire | Format |
|---------|-------------|--------|
| `matricule` | oui | doit exister dans ASTER ou dans le lot collaborateurs |
| `solde_cp_jours` | un solde min. | décimal (`,` ou `.`), ≥ 0 |
| `solde_rtt_jours` | un solde min. | idem |
| `solde_recuperation_heures` | un solde min. | heures → jours via 7 h/jour (standard) |
| `date_effet` | oui | `AAAA-MM-JJ` ou `JJ/MM/AAAA` |
| `reference_source` | recommandé | référence d'audit Excel |
| `statut_verification_rh` | recommandé | `verifie` / `vérifié` |
| `notes` | non | texte libre |

### Template C — Historique (optionnel, non exécuté)

Structure future : congés / absences / télétravail / récupérations historiques.
**Non activé** à l'onboarding initial — modèle fourni pour compatibilité seulement.

## Mapping de colonnes

À l'upload, ASTER détecte les en-têtes FR/EN courants (`prenom` → `firstName`, `solde_cp_jours` → `cpDays`, etc.).
Les mappings département / site sont configurables sur le lot (JSON) pour aligner les libellés Excel sur le référentiel.

## Workflow

1. Télécharger le(s) modèle(s).
2. Remplir sans inventer d'e-mails ni de mots de passe.
3. Téléverser le classeur `.xlsx`.
4. Prévisualiser feuilles, en-têtes, lignes et soldes.
5. Corriger le fichier et re-téléverser si erreurs (aucune ligne invalide n'est ignorée silencieusement).
6. Option : cocher **Mettre à jour les fiches existantes** (aperçu champ par champ via messages de ligne).
7. Saisir **IMPORTER** pour confirmer explicitement.
8. Exécution en lot contrôlé + rapport de réconciliation téléchargeable.

## Règles de validation (extraits)

- Matricules / e-mails manquants ou en double
- Dates et décimaux invalides
- Départements inconnus
- Statuts / contrats invalides
- Soldes négatifs refusés
- Matricules de solde inconnus
- Doublons de lignes de solde
- Sites hors référentiel → avertissement (pas d'invention de données)

## Sémantique des soldes d'ouverture

Les soldes importés sont des écritures ledger **append-only** :

- `transactionType` = `opening_balance`
- `sourceKind` = `hr_excel_import_opening`
- `sourceId` = `{batchId}:{matricule}:{account}` (idempotent)
- Métadonnées : lot, référence source, statut de vérification RH, notes, heures de récupération

**Interdit :** recalcul d'acquisition historique, postings mensuels dérivés des soldes Excel, écrasement silencieux d'ouvertures existantes, assimilation des demandes en attente à de la consommation.

Les réservations en attente restent distinctes des soldes consommés. Toute correction ultérieure passe par le workflow d'ajustement audité du ledger.

## Idempotence et sécurité

- Chaque lot a un `batchId` unique ; réexécution d'un lot `completed` refusée.
- Réessai après `failed` : revalider puis confirmer à nouveau.
- Fichiers traités en privé (stockage `imports/private/...` si adaptateur présent) ; pas d'URL publique.
- Pas de journalisation inutile de données nominatives sensibles.

## Réconciliation

Le rapport post-import indique : lot, date, administrateur RH, créations / mises à jour, soldes importés, rejets, avertissements, totaux par catégorie, interventions manuelles, et une vue Excel ↔ ASTER par matricule.

## Corrections

Ne jamais réécrire une ouverture existante. Utiliser un ajustement ledger audité (RH) pour corriger un écart après import.
