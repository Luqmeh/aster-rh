# ASTER — Progress report

**Date :** 2026-11-09  
**Focus :** Demandes documentaires collaborateur + file RH  
**Statut :** Implémenté et poussé sur `main` — **workflow Production non vérifié** (attendre déploiement Vercel + migrate)

## Fonctionnalités livrées

### Collaborateur — `/documents`
- Catalogue de demandes (attestations, contrats, formation, CNCC si éligible, documents de départ si cycle de vie pertinent, « Autre » avec revue RH).
- Formulaire type + motif / usage.
- Suivi des demandes en cours, historique (disponible / refusée).
- Bibliothèque des documents **publiés** + téléchargement URL signée.
- Zone PeopleDoc informative (guide p.65–66) — **pas** de demande de bulletin RH, **pas** d’URL inventée.
- Notifications : soumission, clarification, refus, disponibilité.

### RH / Chef — `/administration/documents`
- File de travail (filtres statut / type / recherche nom).
- Détail demande, prise en traitement, clarification, refus.
- Upload fichier (non visible tant que non publié).
- Action explicite **Mettre à disposition**.
- Note interne RH (jamais exposée au collaborateur).
- Historique d’événements / timestamps.

### Données & storage
- Modèles Prisma `DocumentRequest` + `DocumentRequestEvent` + migration `20261109020000_document_requests`.
- Namespace Storage séparé : `employee-documents/{employeeId}/{requestId}/…` (CV recrutement inchangé).
- Ownership serveur + publication explicite + révocation libre-service si compte inactif/parti.
- Permissions centralisées (`document_request.*`) — Chef hérite RH ; RH ne gagne pas d’approbations manager ailleurs.

## Fichiers principaux

| Zone | Fichiers |
|------|----------|
| Domaine | `document-requests.ts`, types `DocumentRequest*`, permissions |
| App | `document-request-service.ts` (+ tests) |
| Persistence | `hr-repository`, demo/prisma repos, mappers, demo-store |
| Prisma | `schema.prisma`, migration SQL |
| Actions / UI | `document-requests.ts` actions, forms, `/documents`, `/administration/documents/*` |
| Docs | `HR_REQUIREMENTS.md`, `AUTHORIZATION_MATRIX.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, `README.md` |

## Dépendances

Aucune nouvelle dépendance npm.

## Tests

```
npx vitest run src/domain/rules/document-requests.test.ts \
  src/application/services/document-request-service.test.ts \
  src/infrastructure/storage/supabase-storage.test.ts
→ 19 passed
```

Couvre : création soi / refus autrui, isolation vues, RH+Chef traitement, non-publication avant publish, download owner, refus chemins `recruitment/`, éligibilité départ/CNCC, anti-doublon notifs.

## Typecheck / lint / build

| Check | Résultat |
|-------|----------|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK (routes `/administration/documents` présentes) |

## Hypothèses démo (non attribuées au guide comme catalogue)

- Catalogue de types ASTER = proposition produit, **pas** inventaire exhaustif du guide.
- CNCC : éligible si intitulé contient « CAC » / « commissaire » (Léa démo mise à jour).
- Documents de départ : `parti` ou `inactif` + date de départ.

## Issues restantes

- Production : migration `DocumentRequest` via `build:vercel` / `prisma migrate deploy` — à confirmer après déploiement.
- Upload Production dépend toujours du bucket privé `aster-private-docs` sur le **bon** projet Supabase.
- Vérification manuelle du parcours live (collaborateur → RH → publier → télécharger) **non faite** dans cette session.

## Prochaine étape exacte

1. Attendre le déploiement Vercel de ce commit (migrate Production).
2. Se connecter collaborateur → `/documents` → créer une attestation.
3. Se connecter RH → `/administration/documents` → traiter, uploader, **Mettre à disposition**.
4. Revenir collaborateur → télécharger ; confirmer qu’un fichier non publié reste inaccessible.
