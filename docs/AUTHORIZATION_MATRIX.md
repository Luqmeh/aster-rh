# ASTER — Matrice d’autorisation

Hiérarchie définitive (permanente) :

1. **Chef de projet** (`chef_de_projet`) — privilège applicatif maximal (HR + validations, portée globale).
2. **Ressources humaines** (`admin_rh`) — administration RH et lecture des demandes, **sans** décision.
3. **Collaborateur** (`collaborateur`) — libre-service personnel uniquement.

Les décisions d’accès sont **toujours** vérifiées côté serveur (session Auth.js + `src/domain/rules/permissions.ts`). Le navigateur ne choisit jamais le rôle.

| Capacité | Collaborateur | Ressources humaines | Chef de projet |
|----------|---------------|---------------------|----------------|
| Connexion / déconnexion | Oui | Oui | Oui |
| Tableau de bord personnel | Oui | Oui | Oui |
| Profil personnel | Oui (soi) | Oui (soi) | Oui (soi) |
| Édition infos personnelles autorisées | Oui (soi) | Oui (soi) | Oui (soi) |
| Soldes / demandes de congés (soi) | Oui | Oui | Oui |
| Plans télétravail (soi) | Oui | Oui | Oui |
| Documents / notifications (soi) | Oui | Oui | Oui |
| Calendrier personnel | Oui | Oui | Oui |
| Annuaire / fiches collaborateurs | Non | Oui | Oui |
| Gestion RH des fiches | Non | Oui | Oui |
| Voir toutes les demandes (congés / télétravail) | Non | Oui | Oui |
| Approuver / refuser congés ou télétravail | Non | **Non** | Oui (portée globale) |
| Administration RH (`/administration`) | Non | Oui (lecture) | Oui (lecture + décision) |
| Reset données démo (`ASTER_MODE=demo`) | Non | Oui | Oui |
| Changer son propre rôle | Non | Non | Non |
| S’auto-provisionner Chef de projet / RH | Non | Non | Non |

## Règles d’or

1. L’`employeeId` / `role` du client n’est jamais trusté : lecture depuis la session serveur.
2. Le Chef de projet a une portée globale (pas limitée à une équipe assignée).
3. La RH ne peut jamais invoquer une action de validation, même via appel serveur direct.
4. Les comptes inactifs (`UserAccount.isActive` / `Employee.isActive`) ne s’authentifient pas.
5. Pas d’inscription ouverte : provisioning seed / admin / liaison Entra contrôlée.
6. Ne pas réintroduire un rôle Manager inférieur sans autorisation explicite.
