# ASTER — Matrice d’autorisation

Rôles applicatifs strictement séparés. Les décisions d’accès sont **toujours** vérifiées côté serveur (session Auth.js + règles domaine). Le navigateur ne choisit jamais le rôle.

| Capacité | Collaborateur | Manager | Administrateur RH |
|----------|---------------|---------|-------------------|
| Connexion / déconnexion | Oui | Oui | Oui |
| Tableau de bord personnel | Oui | Oui | Oui |
| Profil personnel | Oui (soi) | Oui (soi) | Oui (soi) |
| Soldes / demandes de congés (soi) | Oui | Oui | Oui |
| Plans télétravail (soi) | Oui | Oui | Oui |
| Documents / notifications (soi) | Oui | Oui | Oui |
| Calendrier personnel | Oui | Oui | Oui |
| Voir équipe assignée | Non | Oui | Oui (annuaire RH) |
| Approuver congés / télétravail **équipe** (`en_attente_manager`) | Non | Oui (rapports directs uniquement) | **Non** |
| Approuver file **RH** (`en_attente_rh`) | Non | Non | Oui |
| Administration RH (`/administration`) | Non | Non | Oui |
| Reset données démo (`ASTER_MODE=demo`) | Non | Non | Oui |
| Changer son propre rôle | Non | Non | Non |
| S’auto-provisionner Manager / RH | Non | Non | Non |

## Règles d’or

1. L’`employeeId` / `role` du client n’est jamais trusté : lecture depuis la session serveur.
2. Un manager n’accède qu’aux collaborateurs dont `managerId === session.employee.id`.
3. Un RH ne peut pas « se faire passer » pour un manager pour valider la file manager.
4. Les comptes inactifs (`UserAccount.isActive` / `Employee.isActive`) ne s’authentifient pas.
5. Pas d’inscription ouverte : provisioning seed / admin / liaison Entra contrôlée.
