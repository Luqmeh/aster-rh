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

Migration `20261111160000_ma_annual_leave_fields` :

- `Employee.birthDate` (date nullable) — art. 231 moins de 18 ans.
- `Employee.activitySector` (`non_agricole` \| `agricole`) — art. 238-2.

## Politiques Phase 2 FR

- Versions seed FR marquées `jurisdiction=FR`, `isActive=false`, `effectiveTo` renseigné.
- Conservées pour **compréhension historique** des métadonnées d’écritures déjà postées.
- Le moteur MA **ignore** les politiques `jurisdiction=FR` pour preview/post.

## Compatibilité soldes

- Soldes / écritures `rtt` et `conges_payes*` restent lisibles.
- UI : RTT présenté comme solde historique / avantage non statutaire MA tant que non confirmé.
- Nouveaux accruals MA : politique `MA_ANNUAL_LEAVE_STATUTORY` (`guide_documented` ou `hr_configured`) + preview + statut `calculated` + ≥ 6 mois de service ; pas de bulk Production automatique.

## Rollback

- Réactiver une politique = nouvelle version ou `isActive=true` contrôlé — **jamais** UPDATE des quantités ledger.
- Le champ `category=cadre|non_cadre` reste lisible pour anciennes fiches.

## Déploiement

- Migrate via pipeline Vercel Production existant.
- Ne pas activer le seed démo en Production.
