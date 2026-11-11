# Rôles et permissions ASTER (Maroc)

Exactement **trois** rôles applicatifs. Pas de rôle « Manager » distinct.

Code source de vérité : `src/domain/rules/permissions.ts` (+ enforcement serveur dans les services / actions).

## CHEF_DE_PROJET (Chef de projet)

- Portée globale.
- Toutes les capacités RH + validations opérationnelles.
- Approuve / refuse congés, télétravail, recrutement (décisions), travail férié.
- Accès annuaire, reporting, administration des droits, corrections calendrier.
- Visibilité opérationnelle des absences **sans** accès aux pièces médicales.

## HR_ADMIN (Ressources humaines)

- Administration RH : dossiers, documents, absences admin, reporting, droits (preview/post selon règles).
- Consultation des demandes et historiques.
- **Ne peut pas** approuver/refuser les demandes réservées au pilotage opérationnel (congés, télétravail, etc.).
- Accès aux justificatifs médicaux autorisés.

## EMPLOYEE (Collaborateur)

- Self-service personnel uniquement.
- Pas d’accès aux dossiers confidentiels des autres.
- Pas d’administration RH ni d’approbations.

## Données sensibles

| Donnée | Collaborateur | RH | Chef |
|--------|---------------|----|------|
| Solde / demandes soi | Oui | Oui | Oui |
| Justificatif médical | soi (dépôt) | Oui | Non |
| Notes RH confidentielles | Non | Oui | Selon workflow (pas via entitlement) |

Masquer un bouton ≠ contrôle d’accès : chaque action serveur vérifie le rôle.
