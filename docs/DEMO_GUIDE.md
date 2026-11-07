# Guide de démonstration — ASTER

Public cible : conseil d’administration PKF Arsilon — **13 novembre 2026**.

## Message d’ouverture (30 s)

> ASTER est un prototype de plateforme RH moderne, en français, conçu pour remplacer l’expérience Kammi.  
> Nous sommes en **mode démonstration** avec des données fictives. Ce n’est pas l’authentification de production.

Montrer le bandeau ambre en haut de l’écran.

## Scénario recommandé (8–10 min)

### 1. Collaborateur — Léa Dubois (2 min)

1. Sélectionner **Léa Dubois** dans le panneau d’identités.
2. **Tableau de bord** : soldes CP/RTT, notifications.
3. **Congés** : soumettre une demande courte (ex. 1 jour RTT).
4. **Télétravail** : demander un jour occasionnel.
5. **Annuaire** : rechercher un collègue.
6. **Mon profil** : fiche cadre, manager Julien Bernard.

### 2. Manager — Julien Bernard (3 min)

1. Basculer vers **Julien Bernard**.
2. Tableau de bord : compteur « À valider ».
3. **Congés** / **Télétravail** : approuver ou refuser une demande d’équipe.
4. Mentionner la distinction **cadre / non-cadre** visible dans l’annuaire (Thomas Petit = non-cadre).

### 3. Administrateur RH — Camille Moreau (2 min)

1. Basculer vers **Camille Moreau**.
2. **Administration RH** : effectifs, départements, file de validation.
3. **Documents RH** : bibliothèque mock.
4. Montrer un module **planifié** (ex. Formations) avec le bandeau « bientôt ».

### 4. Clôture (1 min)

- Architecture prête pour Entra ID, e-mail, stockage, paie (adaptateurs).
- Roadmap : `docs/ROADMAP.md`.
- Prochaine étape : brancher Supabase + aligner les règles sur le guide RH page à page.

## Identités

| Bouton | Rôle | Objectif |
|--------|------|----------|
| Léa Dubois | Collaborateur | Parcours demandeur |
| Julien Bernard | Manager | Validations |
| Camille Moreau | Admin RH | Vue transverse |

## Réinitialisation

**Paramètres → Réinitialiser les données démo** si l’état mémoire devient confus pendant les répétitions.

## Points à ne pas promettre

- SSO Microsoft déjà opérationnel
- Connexion paie réelle
- Exhaustivité réglementaire des soldes sans validation guide RH
