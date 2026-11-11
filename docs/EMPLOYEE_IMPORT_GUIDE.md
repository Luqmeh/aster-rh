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

## Persistance durable des lots

Chaque lot est enregistré en base PostgreSQL (`HrImportBatch`) lorsque `ASTER_PERSISTENCE=prisma` / `DATABASE_URL` est présent ; en mode mémoire de démo, les lots vivent dans le store démo (survivent à un redémarrage du cache parse).

Champs clés : `id`, statut, type/version de modèle, fichier source (nom + `storageKey` privé), auteur RH, timestamps (`createdAt`, `validatedAt`, `executionStartedAt`, `executedAt`), compteurs (lignes, créations, soldes, comptes), brouillons de validation, rapport d'exécution / réconciliation, résumé d'échec.

Les classeurs ne sont **jamais** exposés publiquement (`imports/private/...`). Après exécution réussie, le cache local du fichier est purgé ; le rapport reste en base.

### Cycle de vie

`uploaded` → `validating` → `awaiting_confirmation` → `executing` → `completed` | `completed_with_errors` | `failed`

- Claim atomique avant exécution : empêche les doubles lancements concurrents.
- `completed` / `completed_with_errors` : réexécution refusée.
- Lot bloqué en `executing` : récupération manuelle RH → `failed` (pas de retry automatique qui dupliquerait le ledger).
- Depuis `failed` : nouvelle confirmation `IMPORTER` possible ; créations employés / ouvertures ledger / comptes restent idempotentes.

## Modèles Excel

Téléchargeables depuis l'assistant (`.xlsx`, max 5 Mo). Version modèle actuelle : `1`.

### Template A — Collaborateurs

| Colonne | Obligatoire | Format / valeurs |
|---------|-------------|------------------|
| `matricule` | oui | Identifiant unique ASTER |
| `prenom` | oui | texte |
| `nom` | oui | texte |
| `email_professionnel` | recommandé | e-mail réel ; **absent** → fiche OK, compte en attente |
| `departement` | oui | code (`AUD`, `RH`…) ou libellé ; mappable |
| `poste` | oui | texte |
| `site` | oui | texte ; mappable ; site inconnu → avertissement |
| `date_embauche` | oui | `AAAA-MM-JJ` ou `JJ/MM/AAAA` |
| `type_contrat` | oui | `cdi`, `cdd`, `alternance`, `stage` |
| `statut_emploi` | oui | `actif`, `inactif`, `parti` |
| `matricule_manager` | non | matricule existant ou présent dans le lot |

Sans e-mail, ASTER pose un marqueur technique `@no-mailbox.aster-rh.local` (pas de boîte mail, pas de compte).

### Template B — Soldes d'ouverture

| Colonne | Obligatoire | Format |
|---------|-------------|--------|
| `matricule` | oui | doit exister dans ASTER ou dans le lot |
| `solde_cp_jours` / `solde_rtt_jours` / `solde_recuperation_heures` | au moins un | décimal ≥ 0 ; récupération en heures → jours (7 h) |
| `date_effet` | oui | date |
| `reference_source` | recommandé | audit |
| `statut_verification_rh` | recommandé | `verifie` |
| `notes` | non | texte |

### Template C — Historique (optionnel)

Structure future uniquement — **non exécuté**.

## Mapping de colonnes

Détection automatique des en-têtes FR/EN. Mappings département / site stockés sur le lot.

## Workflow

1. Télécharger le(s) modèle(s).
2. Remplir sans inventer d'e-mails ni de mots de passe, sans rôles RH/Chef dans le fichier.
3. Téléverser le `.xlsx`.
4. Prévisualiser et corriger / re-téléverser si besoin.
5. Option : **Mettre à jour les fiches existantes**.
6. Confirmer avec **IMPORTER**.
7. Consulter le rapport persisté (réconciliation + provisioning comptes).

## Provisioning des comptes ASTER

Lors de la création d'un collaborateur importé :

| Situation | Résultat |
|-----------|----------|
| E-mail pro valide, pas de compte | Compte `collaborateur` créé, `mustChangePassword=true`, mot de passe temporaire **envoyé par e-mail uniquement** (jamais dans le rapport / Excel / logs) |
| Compte déjà lié | `already_existing` — credentials non écrasés |
| E-mail absent | `pending` — fiche créée, pas de compte |
| Échec technique | `failed` — visible dans le rapport ; lot éventuellement `completed_with_errors` |

Le fichier Excel **ne peut pas** attribuer `admin_rh` ni `chef_de_projet`.

Un compte ASTER ≠ boîte mail entreprise.

Reprovisioning / reset : opération RH **explicite** et auditée (`reprovisionImportedAccount`) — jamais déclenchée silencieusement par un ré-import.

## Soldes d'ouverture (ledger)

Écritures append-only :

- `transactionType` = `opening_balance`
- `sourceKind` = `hr_excel_import_opening`
- `sourceId` = `{batchId}:{matricule}:{account}`

Pas de recalcul d'acquisition, pas d'écrasement d'ouvertures existantes, pas d'assimilation des demandes en attente.

## Idempotence et reprise

- Un seul claim d'exécution à la fois.
- Réexécution d'un lot terminé refusée.
- Reprise après `failed` : sans doublon ledger / sans écrasement de mots de passe.
- Pas de retry background automatique.

## Réconciliation

Rapport persisté : lot, date, auteur, créations / mises à jour, soldes, comptes (créés / existants / pending / failed), rejets, avertissements, interventions manuelles, comparaison Excel ↔ ASTER par matricule. Téléchargement Excel du rapport disponible pour RH et Chef.
