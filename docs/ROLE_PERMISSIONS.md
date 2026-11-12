# Rôles et permissions ASTER (Maroc)

Exactement **trois** rôles applicatifs (enum DB inchangé).

| Enum DB | Libellé UI |
|---------|------------|
| `chef_de_projet` | Senior Manager |
| `admin_rh` | Responsable RH |
| `collaborateur` | Collaborateur |

Code source de vérité : `src/domain/rules/permissions.ts` (+ enforcement serveur dans les services / actions / UI).

## Distinction fondamentale

| Action | Collaborateur | Senior Manager | Responsable RH |
|--------|---------------|----------------|----------------|
| Soumettre une demande **personnelle** (congés, TT, absence, document, férié) | Oui | **Non** | **Non** |
| Approuver / refuser les demandes collaborateurs | Non | Oui | **Non** (lecture seule) |
| Administrer RH / dossiers / import | Non | Oui (sauf exécution import) | Oui |

Soumettre ≠ traiter : les modules Congés / Télétravail / Absences / Documents restent accessibles aux comptes management pour la **file** et l’administration, sans formulaire de libre-service personnel.

## CHEF_DE_PROJET (Senior Manager)

- Portée globale.
- Validations opérationnelles (congés, télétravail, recrutement, travail férié).
- Accès annuaire, reporting, administration, corrections calendrier.
- Visibilité opérationnelle des absences **sans** accès aux pièces médicales.
- **Sans** libre-service employé (`*.submit` personnel retiré).

## ADMIN_RH (Responsable RH)

- Administration RH : dossiers, documents, absences admin, reporting, import Excel.
- Consultation des demandes et historiques.
- **Ne peut pas** approuver/refuser les demandes réservées au Senior Manager.
- Accès aux justificatifs médicaux autorisés.
- **Sans** libre-service employé.

## COLLABORATEUR

- Libre-service personnel complet (congés, télétravail, absences, documents, férié).
- Pas d’accès aux dossiers confidentiels des autres.
- Pas d’administration RH ni d’approbations.
- Compte créé à l’onboarding / provisioning avec `mustChangePassword` selon le flux existant.

## Onboarding

1. RH ou Senior Manager crée la fiche.
2. Compte credentials provisionné en rôle `collaborateur` (sauf attribution privilégiée explicite réservée au Senior Manager).
3. Libre-service collaborateur actif après premier changement de mot de passe si requis.
4. Les demandes apparaissent dans les files Senior Manager ; la RH conserve la lecture administrative.

## Données sensibles

| Donnée | Collaborateur | RH | Senior Manager |
|--------|---------------|----|----------------|
| Solde / demandes soi | Oui | Non (pas de libre-service) | Non (pas de libre-service) |
| Justificatif médical | soi (dépôt) | Oui | Non |
| Notes RH confidentielles | Non | Oui | Selon workflow |

Masquer un bouton ≠ contrôle d’accès : chaque action serveur vérifie le rôle (`hasPermission` / helpers `canSubmit*`).
