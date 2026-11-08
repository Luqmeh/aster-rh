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

## Stockage CV (`aster-private-docs`)

| Règle | Implémentation |
|-------|----------------|
| Bucket | Nom exact `aster-private-docs` (privé, `public=false`) |
| Upload | Server-side uniquement après session + `recruitment.create` (RH / Chef) |
| Download | Server-side après contrôle d’accès dossier ; URL **signée ≤ 120 s** |
| Chemins | `recruitment/{candidateId}/…` — refus si la clé ne correspond pas au dossier |
| Production | **Pas de fallback mock** si Supabase n’est pas configuré (erreur explicite) |
| Local / tests | Mock mémoire autorisé sans clés |
| RLS | Aucune policy `anon` / `authenticated` ; accès via `SUPABASE_SERVICE_ROLE_KEY` serveur uniquement |

Variables : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  
Optionnel : `ASTER_STORAGE_BUCKET` (doit rester `aster-private-docs` en prod)  
Secours local uniquement : `ASTER_ALLOW_MOCK_STORAGE=1`

SQL de sécurisation bucket : `docs/supabase/storage-aster-private-docs.sql`  
Vérification : `npx tsx scripts/verify-storage-bucket.ts`

Formats : PDF / DOC / DOCX, max 5 Mo.

## Audit

Chaque action majeure produit un `RecruitmentEvent` (création, CV, soumission, décision, assignation) et des notifications ciblées.
