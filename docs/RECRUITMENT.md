# Recrutement — workflow ASTER

Module de **recrutement externe** (distinct des entretiens de performance futurs).  
Les candidats ne créent **pas** automatiquement une fiche `Employee`.

## Rôles

| Étape | Ressources humaines | Chef de projet | Collaborateur assigné |
|-------|---------------------|----------------|------------------------|
| Créer / éditer brouillon + CV + notes | Oui | Oui (hérite HR) | Non |
| Soumettre pour revue | Oui | Oui | Non |
| Approuver / refuser | **Non** | Oui | Non |
| Assigner intervieweur (`Appliquer`) | Non | Oui | Non |
| Voir dossier / CV assigné | Oui (tous) | Oui (tous) | Uniquement ses assignations |

## Statuts

- Brouillon
- Soumis pour revue
- Refusé
- Approuvé
- Intervieweur assigné
- Entretien planifié
- Entretien terminé

L’assignation ne marque **pas** l’entretien comme terminé.

## Stockage CV

- Port `DocumentStoragePort`
- Production : Supabase Storage bucket privé `aster-private-docs` (ou `ASTER_STORAGE_BUCKET`)
- Accès via **URL signée courte** (≈ 120 s), jamais d’URL publique permanente
- Variables : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Formats : PDF / DOC / DOCX, max 5 Mo

Sans clés Supabase, le mock mémoire est utilisé (démo / tests).

## Audit

Chaque action majeure produit un `RecruitmentEvent` (création, CV, soumission, décision, assignation) et des notifications ciblées.
