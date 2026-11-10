# Guide de démonstration — ASTER

Public cible : conseil d’administration PKF Arsilon — **13 novembre 2026**.

## Message d’ouverture (30 s)

> ASTER est un prototype de plateforme RH moderne, en français, conçu pour remplacer l’expérience Kammi.  
> Les comptes de démonstration sont provisionnés ; ce n’est pas l’authentification de production Entra ID.

## Scénario recommandé (8–10 min)

### 1. Collaborateur — Léa Dubois (2 min)

1. Se connecter avec le compte collaborateur.
2. **Tableau de bord** : soldes CP/RTT, notifications.
3. **Congés** : soumettre une demande courte (ex. 1 jour RTT).
4. **Télétravail** : planifier un mois.
5. **Mon profil** : fiche cadre, manager hiérarchique Julien Bernard ; édition des infos personnelles autorisées.
6. Vérifier qu’**Annuaire** n’est pas accessible.

### 2. Chef de projet — Julien Bernard (3 min)

1. Se connecter avec le compte Chef de projet.
2. Tableau de bord : demandes à traiter + raccourcis administration.
3. **Congés** / **Télétravail** / **Administration RH** : approuver ou refuser.
4. **Annuaire** : ouvrir une fiche et montrer la gestion RH.

### 3. Ressources humaines — Camille Moreau (2 min)

1. Se connecter avec le compte RH.
2. **Administration RH** : effectifs, départements, file en lecture.
3. Montrer qu’aucune action d’approbation n’est proposée, et qu’un appel serveur direct est refusé.
4. **Annuaire** : éditer une fiche collaborateur.
5. (Optionnel) Créer un collaborateur : la modale affiche e-mail + mot de passe temporaire **jusqu’à fermeture explicite** ; à la première connexion, changement obligatoire.
6. Montrer un module **planifié** (ex. Formations).

### 4. Clôture (1 min)

- Architecture prête pour Entra ID, e-mail, stockage, paie (adaptateurs).
- Roadmap : `docs/ROADMAP.md`.
- Hiérarchie permanente : Chef de projet > Ressources humaines > Collaborateur.

## Comptes

| Compte | Rôle | Objectif |
|--------|------|----------|
| Léa Dubois | Collaborateur | Parcours demandeur |
| Julien Bernard | Chef de projet | Validations + RH |
| Camille Moreau | Ressources humaines | Administration sans décision |

## Réinitialisation

**Paramètres → Réinitialiser les données démo** (si `ASTER_MODE=demo`) si l’état devient confus pendant les répétitions.

## Points à ne pas promettre

- SSO Microsoft déjà opérationnel
- Connexion paie réelle
- Exhaustivité réglementaire des soldes sans validation guide RH
