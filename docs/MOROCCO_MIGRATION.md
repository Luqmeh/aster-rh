# Migration Morocco-first — impacts données

## Non négociable

- Pas de DROP/TRUNCATE des tables métier.
- Pas de réécriture des `LeaveLedgerEntry` historiques.
- Pas de reset mots de passe.
- Pas de suppression des 3 rôles.
- Migrations **additives** uniquement.
- Pas de posting automatique de droits MA non validés.

## Changements schéma (additif)

Migration `20261111010000_morocco_first` :

- Enum `EmployeeCategory` : valeur `non_applicable`.
- `Employee.policyGroup` (texte nullable) — groupe de politique employeur, indépendant du titre.
- `EntitlementPolicyVersion.jurisdiction` (`FR` \| `MA` \| `UNSET`) + `isActive` (bool).
- Pas de suppression des comptes ledger FR.

## Politiques Phase 2 FR

- Versions seed FR marquées `jurisdiction=FR`, `isActive=false`, `effectiveTo` renseigné.
- Conservées pour **compréhension historique** des métadonnées d’écritures déjà postées.
- Le moteur MA **ignore** les politiques `jurisdiction=FR` pour preview/post.

## Compatibilité soldes

- Soldes / écritures `rtt` et `conges_payes*` restent lisibles.
- UI : RTT présenté comme solde historique / avantage non statutaire MA tant que non confirmé.
- Nouveaux accruals MA : uniquement si politique `MA_*` + `hr_configured` + preview validée.

## Rollback

- Réactiver une politique = nouvelle version ou `isActive=true` contrôlé — **jamais** UPDATE des quantités ledger.
- Le champ `category=cadre|non_cadre` reste lisible pour anciennes fiches.

## Déploiement

- Migrate via pipeline Vercel Production existant.
- Ne pas activer le seed démo en Production.
