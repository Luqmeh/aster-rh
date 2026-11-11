# ASTER — Human Resources, connected.

Prototype de plateforme RH pour le **département Maroc** de **PKF Arsilon** (interface en français `fr-MA`, fuseau `Africa/Casablanca`, devise MAD).

> Produit de présentation (conseil, novembre 2026).  
> Données fictives. L’auth temporaire n’est **pas** un SSO de production.  
> Les politiques RH France ne sont pas des défauts Maroc — voir `docs/MOROCCO_HR_POLICY.md`.

## Stack

- Next.js App Router (React, TypeScript)
- Auth.js (next-auth v5) — credentials temporaires + Microsoft Entra ID (config)
- Tailwind CSS + composants style shadcn/ui + Lucide
- Zod · Prisma · PostgreSQL (Supabase) · Supabase Storage (CV + documents privés)
- Calendrier fériés marocains + récupération travail férié (règle produit ASTER)

## Hiérarchie des rôles (définitive)

1. **Chef de projet** — HR + toutes validations (portée globale)
2. **Ressources humaines** — administration / lecture, sans décisions d’approbation
3. **Collaborateur** — libre-service (+ entretiens assignés)

## Démarrage rapide

```bash
npm install
cp .env.example .env.local
# Renseigner AUTH_SECRET, DATABASE_URL/DIRECT_URL (ou mémoire), ASTER_SEED_PASSWORD pour seed
npm run db:migrate && ASTER_SEED_PASSWORD='…' npm run db:seed   # si Prisma
npm run dev
```

Ouvrir [http://localhost:3000/connexion](http://localhost:3000/connexion).

Comptes seed (après seed avec `ASTER_SEED_PASSWORD`) :

| E-mail | Rôle |
|--------|------|
| `imane.chraibi@demo.aster-rh.local` | Collaborateur |
| `youssef.alaoui@demo.aster-rh.local` | Chef de projet |
| `sara.benali@demo.aster-rh.local` | Ressources humaines |

Pas de bascule de rôle dans l’UI — chaque compte a un rôle serveur fixe.

## Modules clés

- Congés / télétravail / calendrier / travail férié & récupération
- Annuaire, onboarding, cycle de vie (actif / inactif / parti)
- Recrutement externe (`/entretiens`) avec CV privés et revue Chef de projet
- Demandes de documents RH (`/documents`, `/administration/documents`)
- Reporting RH & exports Excel (`/administration/rapports`) — RH + Chef de projet
- Arrêts de travail & absences spéciales (`/absences`, `/administration/absences`)

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production (offline DB) |
| `npm run build:vercel` | Build Vercel (migrate Production + Next) |
| `npm run lint` / `typecheck` / `test` | Qualité |

## Documentation

- [AGENTS.md](./AGENTS.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/AUTHORIZATION_MATRIX.md](./docs/AUTHORIZATION_MATRIX.md)
- [docs/RECRUITMENT.md](./docs/RECRUITMENT.md)
- [docs/REPORTING.md](./docs/REPORTING.md)
- [docs/ABSENCES.md](./docs/ABSENCES.md)
- [docs/SSO_HANDOVER.md](./docs/SSO_HANDOVER.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/DEMO_GUIDE.md](./docs/DEMO_GUIDE.md)
- [docs/ASTER_SCOPE.md](./docs/ASTER_SCOPE.md)
- [docs/MOROCCO_HR_POLICY.md](./docs/MOROCCO_HR_POLICY.md)
- [docs/MOROCCO_LOCALISATION.md](./docs/MOROCCO_LOCALISATION.md)
- [docs/MOROCCO_MIGRATION.md](./docs/MOROCCO_MIGRATION.md)
- [docs/ROLE_PERMISSIONS.md](./docs/ROLE_PERMISSIONS.md)

## Sécurité

- Sessions HTTP-only (Auth.js)
- Autorisation serveur stricte (hiérarchie Phase 9/10)
- CV recrutement : bucket privé + URL signée
- Pas de secrets dans le dépôt
