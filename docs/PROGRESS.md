# ASTER — Progress Report

**Date:** 10 novembre 2026  
**Focus:** Panneau contexte collaborateur pour la file d’approbation congés / absences  
**Commit local :** `81baae9`  
**Push status:** failed — `Permission denied (publickey)` (ssh-agent sans identité). Exécuter `eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519 && git push origin main`.  
**Deploy:** non vérifié.

## Implemented features

1. **Panneau contexte collaborateur** à côté de chaque demande de congé en file (`/conges`, `/administration`) et sur le détail d’absence (`/administration/absences/[id]`).
2. **Soldes adaptés au type** :
   - CP / RTT / récupération : acquis, consommé (`*Pris`), disponible (`*Restants`), durée demandée, projection après approbation, autres pending clairement séparés (sans double-compte — le modèle ASTER ne réserve pas au dépôt).
   - Types hors solde (maladie LeaveRequest, exceptionnel, parental, sans solde, arrêts WorkAbsence) : **« Solde non suivi »**.
   - Congés spéciaux : barème existant uniquement (`maxDays` ou non chiffré), jours déjà utilisés année, total projeté.
   - Récupération : crédits ledger + solde recovery.
3. **Historique** : dernier congé/absence pris (approuvé / clôturé uniquement) + historique expandable ; pending/refusé exclus.
4. **Confidentialité** : pas de certificats ni commentaires médicaux dans le panneau ; Chef sans docs médicaux ; RH sans pouvoir d’approbation.
5. **Perf** : chargement batch des contextes leave (anti N+1 sur la file).

## Files changed

| Zone | Fichiers |
|------|----------|
| Domaine | `leave-approval-context.ts` (+ tests) |
| Service | `leave-approval-context-service.ts` (+ tests) |
| UI | `employee-leave-context-panel.tsx`, `pending-leave-request-card.tsx` |
| Pages | `conges/page.tsx`, `administration/page.tsx`, `administration/absences/[id]/page.tsx` |
| Docs | `ARCHITECTURE.md`, `AUTHORIZATION_MATRIX.md`, `HR_REQUIREMENTS.md`, ce `PROGRESS.md` (frais) |

**Non inclus :** `docs/git ssh.txt`.

## Dependencies

Aucune nouvelle dépendance npm.

## Test results

Focused Vitest — **13/13 PASS** :
- `leave-approval-context.test.ts` (7)
- `leave-approval-context-service.test.ts` (6)

## Quality checks

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` (`ASTER_BUILD_WITHOUT_DB=1`) | PASS |

## Known limitations

- Les soldes `*Restants` / `*Pris` ne sont pas débités automatiquement à l’approbation (comportement historique du prototype) — le panneau expose le modèle tel quel + réservations pending informatives.
- Télétravail : pas de panneau soldes (pas de solde congés) ; hors scope « leave/absence ».
- Travail férié (WOH) : crédits visibles surtout via demandes `recuperation` ; panneau dédié calendrier WOH non ajouté.
- Push GitHub bloqué sans clé SSH chargée.

## Next recommended implementation step

Sur la démo Chef : valider une file mixte CP/RTT/récupération/exceptionnel + un arrêt maladie (absence de docs médicaux) ; ensuite, si produit souhaité, débiter atomiquement `*Pris`/`*Restants` à l’approbation pour aligner solde et historique.
