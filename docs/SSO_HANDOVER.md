# ASTER — Handover Microsoft Entra ID (SSO)

Document destiné à l’équipe IT PKF Arsilon pour activer le SSO sans réécrire l’application.

> L’intégration Entra est **prête côté code** (Auth.js + provider Microsoft Entra ID). Elle n’est **pas active** tant que les variables et le flag ne sont pas configurés. Ne pas affirmer que le SSO est en production sans tenant réel.

## Architecture

- Bibliothèque : **Auth.js (next-auth v5)** — sessions JWT HTTP-only.
- Fournisseurs :
  - `credentials` — login temporaire prototype (`ASTER_CREDENTIALS_AUTH`, défaut activé).
  - `microsoft-entra-id` — OIDC Authorization Code + PKCE géré par Auth.js.
- Identité applicative : table `UserAccount` (rôle + lien `Employee`) — **pas** de rôle déduit uniquement de l’e-mail navigateur.
- Callback applicatif : `/api/auth/callback/microsoft-entra-id`

## Checklist administrateur Microsoft

1. Entra admin center → **App registrations** → New registration.
2. Nom : `ASTER RH` (ou convention interne).
3. Supported account types : **Single tenant** (recommandé PKF).
4. Redirect URI (Web) :
   - Production : `https://<domaine-aster>/api/auth/callback/microsoft-entra-id`
   - Local (dev) : `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. Certificates & secrets → créer un **client secret** (noter la valeur immédiatement).
6. API permissions : Microsoft Graph `User.Read` (delegated) + consent admin si requis.
7. (Optionnel) Token configuration : optional claims `email`, `preferred_username`.
8. Noter :
   - Directory (tenant) ID
   - Application (client) ID
   - Client secret value
9. Issuer : `https://login.microsoftonline.com/<tenant-id>/v2.0`

## Variables d’environnement Vercel / runtime

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Secret fort de session Auth.js (obligatoire runtime) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Application (client) ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Client secret |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| `ASTER_ENTRA_AUTH` | `1` pour activer le bouton / provider Entra |
| `ASTER_CREDENTIALS_AUTH` | `0` pour **désactiver** le login temporaire |

Scopes demandés : `openid profile email offline_access User.Read`.

Post-logout : Auth.js redirige vers `/connexion` (page `signIn`).

## Liaison des comptes

1. Provisionner chaque utilisateur dans `UserAccount` (seed / process RH) avec `role` et `employeeId`.
2. Au premier login Entra, ASTER cherche le compte par `externalSubject` (oid) puis par e-mail.
3. **Aucun** compte n’est créé automatiquement ; **aucun** rôle n’est auto-attribué.
4. Pour lier l’oid Microsoft : mettre à jour `authProvider=entra_id` et `externalSubject=<oid>` (process admin).

## Passage SSO exclusif

1. Vérifier logins Entra pour Léa / Julien / Camille (ou comptes réels).
2. Vercel Production : `ASTER_ENTRA_AUTH=1` + variables `AUTH_MICROSOFT_ENTRA_ID_*`.
3. Définir `ASTER_CREDENTIALS_AUTH=0`.
4. Redeploy.
5. Confirmer que `/connexion` n’affiche plus le formulaire mot de passe.
6. Révoquer / rotation des mots de passe seed si encore présents.

## Sécurité

- Ne jamais committer tenant ID / secrets.
- Restreindre l’app registration au tenant PKF.
- Désactiver les comptes `UserAccount.isActive=false` plutôt que supprimer les fiches Employee.
- Revue périodique des redirect URIs.
