# ASTER — Progress Report

**Date:** 10 novembre 2026  
**Focus:** Identifiants d’onboarding persistants + changement de mot de passe obligatoire au premier login  
**Commit local :** `223b126`  
**Push status:** **failed** — clé `~/.ssh/id_ed25519` présente mais non chargée (passphrase / `ssh-add` interactif requis). Exécuter `eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519 && git push origin main`.  
**Deploy:** non vérifié (pas de déploiement lancé dans cette session).

## Implemented features

1. **Modale d’identifiants persistante (RH)**  
   Après création d’un compte credentials, e-mail + mot de passe temporaire restent visibles jusqu’à fermeture explicite ; boutons Copier (e-mail / mdp / les deux) ; avertissement « une seule fois » ; pas d’affichage si échec ; anti double-soumission ; nettoyage du state à la fermeture.

2. **`UserAccount.mustChangePassword`**  
   Flag persistant (Prisma + mémoire). `true` à la création avec mot de passe temporaire ; `false` pour les comptes seed / Entra.

3. **Premier login forcé**  
   Middleware (JWT) + layout (DB via `getSession`) + `requireSession` bloquent l’accès métier. Seuls `/changer-mot-de-passe`, Auth.js et déconnexion restent accessibles. Page dédiée + validation serveur + hash bcrypt + clear atomique du flag + `unstable_update` JWT → redirection tableau de bord.

4. **Reprovisioning sécurisé**  
   Si le plaintext a été perdu : action RH « Régénérer un mot de passe temporaire » (nouvel hash + flag `true` + modale one-shot). Aucune récupération de hash.

5. **Doublons**  
   Les gardes existantes (id / e-mail / compte) empêchent une seconde création. Aucun compte « orphelin » dans le seed ; impossible de retrouver un plaintext déjà hashé.

## Files changed (principaux)

| Zone | Fichiers |
|------|----------|
| Schéma | `prisma/schema.prisma`, `prisma/migrations/20261110010000_must_change_password/` |
| Auth | `account-store.ts`, `authorization.ts`, `session-auth.ts`, `auth.ts`, `auth.config.ts`, `middleware.ts`, `types`, `password-change-gate.ts` |
| Services | `employee-provisioning-service.ts`, `password-change-service.ts`, `password-policy.ts` |
| UI / actions | `employee-onboard-form.tsx`, `onboarding-credentials-modal.tsx`, `lifecycle-role-controls.tsx`, `changer-mot-de-passe/`, `password-change.ts`, layout app |
| Docs | `SSO_HANDOVER.md`, `ARCHITECTURE.md`, `DEMO_GUIDE.md`, ce `PROGRESS.md` (frais) |

**Non inclus :** `docs/git ssh.txt` (local / secrets SSH).

## Dependencies

Aucune nouvelle dépendance npm. Utilise `@radix-ui/react-dialog` et `bcryptjs` déjà présents.

## Test results

Focused Vitest (23 tests) — **PASS** :
- `password-policy.test.ts`
- `onboarding-credentials.test.ts`
- `password-change-gate.test.ts`
- `password-change-service.test.ts`
- `employee-provisioning-service.test.ts`

Suite complète non rejouée (hors périmètre une fois les points d’intégration ciblés verts).

## Quality checks

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` (`ASTER_BUILD_WITHOUT_DB=1`) | PASS — route `/changer-mot-de-passe` générée |

## Known issues

- Push GitHub bloqué sans clé SSH agent (`Permission denied (publickey)`).
- Migration `mustChangePassword` à appliquer sur les environnements Prisma (`migrate deploy` / build Vercel Production).
- Warning Next.js 16 : convention `middleware` dépréciée au profit de `proxy` (préexistant / non traité ici).
- `unstable_update` Auth.js nécessite un cast de typage pour le champ custom `mustChangePassword`.

## Next recommended implementation step

Brancher et valider la migration Prisma sur l’environnement hébergé (Vercel Production + `build:vercel`), puis scénario manuel : onboarding RH → copie identifiants → login collaborateur → blocage → changement mdp → accès tableau de bord ; enfin activer le push SSH et redeploy.
