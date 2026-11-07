# Intégrations — frontières et adaptateurs

ASTER isole les systèmes externes derrière des **ports**. L’équipe autorisée remplace les adaptateurs mock sans réécrire les cas d’usage.

## 1. Microsoft Entra ID (SSO)

| Élément | Détail |
|---------|--------|
| Port | `AuthPort` (`src/infrastructure/auth/types.ts`) |
| Actuel | `demo-auth` — cookie `aster_demo_identity` |
| Cible | Adaptateur OIDC Entra (authorization code + PKCE) |
| Mapping | Groupes Entra → `DemoRole` applicatif (`collaborateur` / `manager` / `admin_rh`) |

**Ne pas** hardcoder de tenant/client secrets dans le code. Utiliser les variables `ENTRA_*` de `.env.example`.

## 2. Identité & accès entreprise

- Provisioning futurs comptes via Entra / HRIS.
- En démo : `demoIdentities` dans `src/data/demo-seed.ts`.
- Séparer clairement `isDemo: true` sur la session.

## 3. Notifications e-mail

| Élément | Détail |
|---------|--------|
| Port | `EmailPort` |
| Actuel | `mock-email` (console) |
| Cibles possibles | Microsoft Graph Mail, SMTP relais entreprise |

Les services appellent `email.send` après soumission / décision — le contenu métier reste dans l’application.

## 4. Stockage documentaire

| Élément | Détail |
|---------|--------|
| Port | `DocumentStoragePort` |
| Actuel | `mock-storage` (URLs `#demo-document:…`) |
| Cibles possibles | SharePoint, Azure Blob, Supabase Storage |

Métadonnées en base (Prisma `HrDocument`) ; binaires hors app.

## 5. Paie

- **Pas d’implémentation** dans le prototype.
- Prévoir une interface future du type `PayrollPort` (lecture bulletins, export absences validées).
- Aucune credential paie dans le dépôt.

## 6. Supabase PostgreSQL

- Schéma : `prisma/schema.prisma`
- Runtime actuel : magasin mémoire (pas de dépendance build → DB)
- Remplacement : `PrismaHrRepository` + `DATABASE_URL`

## Checklist de substitution d’adaptateur

1. Implémenter l’interface du port.
2. Brancher dans `getContainer()`.
3. Ajouter variables dans `.env.example` (placeholders).
4. Documenter le runbook dans ce fichier.
5. Garder `ASTER_MODE=demo` pour les environnements de présentation.
