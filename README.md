# ASTER — Human Resources, connected.

Prototype de plateforme RH en français pour **PKF Arsilon**, destiné à remplacer l’expérience Kammi.pro à terme.

> **Démonstration** — produit de présentation (conseil d’administration, 13 novembre 2026).  
> Ce n’est **pas** un système RH de production. Les identités et données sont fictives.

## Stack

- Next.js App Router (React, TypeScript strict)
- Tailwind CSS + composants style shadcn/ui + Lucide
- Zod (validation)
- Prisma (schéma prêt pour Supabase PostgreSQL)
- Mode démo sans credentials de production

## Démarrage rapide

```bash
npm install
cp .env.example .env.local   # optionnel en mode démo
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Le mode démonstration démarre automatiquement avec trois identités :

| Identité        | Rôle               |
|-----------------|--------------------|
| Léa Dubois      | Collaborateur      |
| Julien Bernard  | Manager            |
| Camille Moreau  | Administrateur RH  |

Basculer via le panneau « Identités de démonstration » (ou la barre mobile).

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production (sans DB locale) |
| `npm run start` | Serveur après build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests Vitest (règles métier) |

## Documentation

- [AGENTS.md](./AGENTS.md) — consignes agents / handover
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)
- [docs/HR_REQUIREMENTS.md](./docs/HR_REQUIREMENTS.md)
- [docs/DEMO_GUIDE.md](./docs/DEMO_GUIDE.md)
- [docs/INTEGRATIONS.md](./docs/INTEGRATIONS.md)

## Modules prioritaires (opérationnels en démo)

- Tableau de bord
- Mon profil
- Annuaire
- Congés et absences (soumission + validation)
- Télétravail (soumission + validation)
- Administration RH
- Notifications / Documents (mock) / Paramètres

Les autres modules affichent une **interface planifiée** clairement identifiée.

## Base de données

- **Local sans PostgreSQL** : magasin mémoire (`ASTER_PERSISTENCE=memory`, défaut).
- **Persistance durable** : Prisma + PostgreSQL/Supabase.
  - Local : `DATABASE_URL` + `DIRECT_URL` dans `.env.local`.
  - Vercel (intégration Supabase) : `POSTGRES_PRISMA_URL` → poolée, `POSTGRES_URL_NON_POOLING` → migrations (mapping automatique, sans duplication).
  ```bash
  npm run db:migrate
  npm run db:seed
  ASTER_PERSISTENCE=prisma npm run dev
  ```
- Guide : [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- `npm run build` reste offline ; sur Vercel Production, `build:vercel` applique `prisma migrate deploy` puis compile. Seed = `npm run db:seed` (hors pipeline).

## Sécurité

- Pas de secrets dans le dépôt
- Cookie de session démo clairement non productif
- Pas de SSO Entra, pas d’accès Outlook, pas d’infra entreprise réelle
