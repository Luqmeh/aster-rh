# ASTER — Human Resources, connected.

Prototype de plateforme RH en français pour **PKF Arsilon**, destiné à remplacer l’expérience Kammi.pro à terme.

> Produit de présentation (conseil d’administration, 13 novembre 2026).  
> Les données sont fictives. L’authentification temporaire du prototype n’est **pas** un SSO de production.

## Stack

- Next.js App Router (React, TypeScript)
- Auth.js (next-auth v5) — credentials temporaires + Microsoft Entra ID (config)
- Tailwind CSS + composants style shadcn/ui + Lucide
- Zod · Prisma · PostgreSQL (Supabase) · Supabase Storage (CV privés)

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
| `lea.dubois@demo.aster-rh.local` | Collaborateur |
| `julien.bernard@demo.aster-rh.local` | Chef de projet |
| `camille.moreau@demo.aster-rh.local` | Ressources humaines |

Pas de bascule de rôle dans l’UI — chaque compte a un rôle serveur fixe.

## Modules clés

- Congés / télétravail / calendrier
- Annuaire, onboarding, cycle de vie (actif / inactif / parti)
- Recrutement externe (`/entretiens`) avec CV privés et revue Chef de projet

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
- [docs/SSO_HANDOVER.md](./docs/SSO_HANDOVER.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/DEMO_GUIDE.md](./docs/DEMO_GUIDE.md)

## Sécurité

- Sessions HTTP-only (Auth.js)
- Autorisation serveur stricte (hiérarchie Phase 9/10)
- CV recrutement : bucket privé + URL signée
- Pas de secrets dans le dépôt
