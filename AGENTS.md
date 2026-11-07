# AGENTS.md — ASTER

Consignes pour les agents et l’équipe de reprise.

## Objectif

Prototype RH français **ASTER** pour démonstration PKF Arsilon. Priorité : vendredi 13 novembre 2026.

## Règles non négociables

1. **Données** — uniquement fictives ; jamais de PDF RH confidentiel, employés réels, contacts ou secrets.
2. **Politiques** — ne pas inventer silencieusement des règles RH ; documenter dans `docs/HR_REQUIREMENTS.md` avec références de pages du guide quand disponibles ; marquer clairement les hypothèses de démo.
3. **Démo ≠ prod** — le mode démonstration et le switch d’identités ne doivent jamais être présentés comme une authentification de production.
4. **Langue** — tout texte utilisateur en français.
5. **Architecture** — logique métier hors composants UI ; ports/adaptateurs pour auth, e-mail, stockage, paie.
6. **Secrets** — pas de `.env` commités ; placeholders dans `.env.example` uniquement.
7. **Build** — Vercel / `next build` ne doit pas dépendre d’une base locale.

## Où modifier quoi

| Besoin | Emplacement |
|--------|-------------|
| Règles congés / télétravail / validations | `src/domain/rules/` |
| Types métier | `src/domain/types/` |
| Cas d’usage | `src/application/services/` |
| Auth démo / futurs adaptateurs | `src/infrastructure/` |
| Seed fictif | `src/data/demo-seed.ts` |
| UI | `src/components/`, `src/app/` |
| Schéma DB cible | `prisma/schema.prisma` |

## Mode démo

- Cookie `aster_demo_identity`
- Persistance : mémoire (`demo-store`) en local **ou** Prisma/PostgreSQL si `DATABASE_URL` / `POSTGRES_PRISMA_URL` / `ASTER_PERSISTENCE=prisma` (Vercel Supabase : mapping auto vers `DATABASE_URL` + `DIRECT_URL`)
- Composition : `src/infrastructure/container.ts`
- Seed / reset démo : `src/infrastructure/persistence/demo-data-lifecycle.ts` + `npm run db:seed`
- Déploiement : `docs/DEPLOYMENT.md`

## Tests

Couvrir les règles métier critiques (soldes, jours ouvrés, plafonds télétravail, droits d’approbation) via Vitest.

## Prochaines itérations

Voir `docs/ROADMAP.md`. Brancher Prisma/Supabase et Entra ID via de nouveaux adaptateurs sans réécrire les services.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
