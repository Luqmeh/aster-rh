# ASTER — Matrice d’autorisation

Hiérarchie définitive (permanente) :

1. **Chef de projet** (`chef_de_projet`) — privilège applicatif maximal (HR + validations, portée globale).
2. **Ressources humaines** (`admin_rh`) — administration RH et lecture des demandes / recrutements, **sans** décision manager-controlled.
3. **Collaborateur** (`collaborateur`) — libre-service + entretiens qui lui sont assignés.

| Capacité | Collaborateur | Ressources humaines | Chef de projet |
|----------|---------------|---------------------|----------------|
| Annuaire / fiches | Non (soi via profil) | Oui | Oui |
| Onboarding collaborateur | Non | Oui (rôle Collaborateur uniquement) | Oui (tous rôles) |
| Cycle de vie actif/inactif/parti | Non | Oui | Oui |
| Attribution rôles privilégiés | Non | Non | Oui |
| Approuver congés / télétravail | Non | Non | Oui |
| Voir demandes congés / télétravail | Soi | Toutes | Toutes |
| Créer / soumettre dossier recrutement | Non | Oui | Oui |
| Approuver / refuser recrutement | Non | **Non** | Oui |
| Assigner intervieweur (`Appliquer`) | Non | Non | Oui |
| Voir CV recrutement | Assignés uniquement | Tous | Tous |
| Demander un document administratif | Soi | Soi | Soi |
| Voir / traiter toutes les demandes documentaires | Non | Oui | Oui |
| Uploader + « Mettre à disposition » un document | Non | Oui | Oui |
| Télécharger document publié | Soi uniquement | Tous (traitement) | Tous (traitement) |
| Administration RH | Non | Oui | Oui |

## Règles d’or

1. Jamais trust du rôle / employeeId client.
2. RH ne décide jamais sur congés, télétravail ou recrutement.
3. Départ / inactif → `UserAccount.isActive=false` + refus d’auth.
4. Pas d’auto-provisioning privilégié.
5. CV / documents : stockage privé `aster-private-docs` + URL signée courte uniquement ; namespaces séparés `recruitment/…` et `employee-documents/…`.
6. Publication documentaire explicite (« Mettre à disposition ») — l’upload seul ne rend pas le fichier visible au collaborateur.
