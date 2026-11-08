# Intégrations — frontières et adaptateurs

ASTER isole les systèmes externes derrière des **ports**. L’équipe autorisée remplace les adaptateurs mock sans réécrire les cas d’usage.

## 1. Microsoft Entra ID (SSO)

| Élément | Détail |
|---------|--------|
| Port | `AuthPort` (`src/infrastructure/auth/types.ts`) |
| Actuel | Auth.js + credentials temporaires (`session-auth`) |
| Cible SSO | Provider `microsoft-entra-id` (activable par env) |
| Mapping | Compte `UserAccount` provisionné → `DemoRole` (pas d’auto-rôle e-mail) |

Voir **`docs/SSO_HANDOVER.md`** pour la checklist IT complète.  
Variables : `AUTH_MICROSOFT_ENTRA_ID_*`, `ASTER_ENTRA_AUTH`, `ASTER_CREDENTIALS_AUTH`, `AUTH_SECRET`.

## 2. Identité & accès

- Provisioning : seed (`ASTER_SEED_PASSWORD`) ou process RH / liaison oid Entra.
- Pas d’inscription ouverte.
- Comptes inactifs refusés à la connexion.

## 3. Notifications e-mail

| Élément | Détail |
|---------|--------|
| Port | `EmailPort` |
| Actuel | `mock-email` (console) |
| Cibles possibles | Microsoft Graph Mail, SMTP relais entreprise |

## 4. Stockage documentaire

| Élément | Détail |
|---------|--------|
| Port | `DocumentStoragePort` |
| Actuel | `mock-storage` |
| Cibles possibles | SharePoint, Azure Blob, Supabase Storage |

## 5. Persistence

| Élément | Détail |
|---------|--------|
| Port | `HrRepository` |
| Actuel | mémoire **ou** Prisma/PostgreSQL |
| Schéma | `prisma/schema.prisma` (+ `UserAccount`) |
