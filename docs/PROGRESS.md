# ASTER — Rapport de progression (frais)

**Date :** 11 novembre 2026  
**Périmètre :** Refactoring Morocco-first (correction produit / domaine)  
**Commit prévu :** voir hash git en bas après commit

## Changements livrés

- Audit France→Maroc (`docs/MOROCCO_AUDIT.md`) + gouvernance (`MOROCCO_HR_POLICY`, `MOROCCO_LOCALISATION`, `MOROCCO_MIGRATION`, `ASTER_SCOPE`, `ROLE_PERMISSIONS`).
- Politiques FR Phase 2 **désactivées** (`jurisdiction=FR`, `isActive=false`) — historique ledger intact.
- Politique MA `MA_ANNUAL_LEAVE_STATUTORY` (baseline 1,5 j/mois proposée) en `requires_hr_decision` — **aucun auto-post**.
- `cadre`/`non_cadre` ne pilotent plus les droits ; ajout `non_applicable` + `policyGroup`.
- Locale centralisée : `fr-MA`, `Africa/Casablanca`, MAD (`aster-locale.ts`).
- Démo Maroc (personas / sites Casablanca–Rabat, départements présentation, RTT démo à 0).
- Télétravail : plafonds traités comme politique produit paramétrable (pas guide FR).
- UI : libellés congé annuel, navigation, droits-conges, formulaire RH.
- Migration additive `20261111010000_morocco_first` (non exécutée en Production depuis ce poste).

## Fichiers clés

- `prisma/schema.prisma`, `prisma/migrations/20261111010000_morocco_first/`
- `src/domain/config/aster-locale.ts`
- `src/domain/rules/entitlement-policies.ts`, `entitlement-accrual.ts`, `leave.ts`, `telework-monthly.ts`
- `src/data/demo-seed.ts`
- Docs Morocco-* / ASTER_SCOPE / ROLE_PERMISSIONS / PROGRESS

## Dépendances

Aucune dépendance npm ajoutée.

## Migrations

- Additive only. Pas de DROP/TRUNCATE. Pas de réécriture ledger.
- Production : pipeline Vercel existant uniquement.

## Tests

```
npx vitest run aster-locale entitlement-accrual entitlement-service leave.test leave-ledger-service permissions
→ 28 tests OK
```

## Qualité

| Check | Résultat |
|-------|----------|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `ASTER_BUILD_WITHOUT_DB=1 npm run build` | OK |

## Règles encore « À valider par RH »

- Barème exact congé annuel / ancienneté (loi 65-99 articles exacts).
- Existence éventuelle d’un avantage type RTT employeur Maroc.
- Week-end réel par site ; convention collective applicable.
- Processus CNSS maladie (stockage vs déclaration — ASTER ne déclare pas).
- Organigramme définitif vs départements démo.

## Limitations

- Texte consolidé officiel 65-99 non récupéré intégralement via fetch auto → baseline documentée mais non `hr_configured`.
- Lots d’accrual toujours en mémoire process (schéma Prisma prêt).
- Pas de déploiement Production / migrate vérifié dans cette session.

## Prochaine étape recommandée

Faire valider par RH/juridique Maroc le barème de congé annuel (articles + ancienneté), passer `MA_ANNUAL_LEAVE_STATUTORY` en `hr_configured` uniquement après validation écrite, puis activer le posting preview contrôlé.

## Git

- Hash / push : renseignés après commit.
