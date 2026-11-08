# Feuille de route ASTER

## Phase 0 — Prototype conseil (objectif 13 nov. 2026) ✅ en cours

- [x] Socle Next.js + design system navy
- [x] Mode démo + switch de rôles
- [x] Dashboards par rôle
- [x] Profil + annuaire
- [x] Congés (soumission, solde, validation Chef de projet ; RH en lecture)
- [x] Télétravail (soumission + validation)
- [x] Administration RH overview
- [x] Modules planifiés signalés
- [x] Documentation + tests règles métier
- [ ] Affinage UX selon retours de répétition de démo
- [ ] Alignement exhaustif des chiffres politiques avec le guide RH (pages)

## Phase 1 — Fondations handover

- [x] Adaptateur Prisma/Supabase + migrations (Phase 6 — code prêt)
- [x] Seed idempotent aligné sur le seed mémoire
- [ ] CI (typecheck, lint, test, build)
- [ ] Déploiement Vercel stable + variables documentées + DB ASTER provisionnée

## Phase 2 — Identité entreprise

- [ ] Adaptateur Microsoft Entra ID SSO
- [ ] Mapping rôles applicatifs ↔ groupes Entra
- [ ] Retrait du switch démo hors environnements `ASTER_MODE=demo`

## Phase 3 — Modules métier

- [ ] Temps de travail (cadre / non-cadre)
- [ ] Notes de frais
- [ ] Documents (stockage réel SharePoint / Blob / Supabase Storage)
- [ ] Entretiens & performance
- [ ] Formations
- [ ] Mobilité interne
- [ ] Rémunération (lecture seule via paie)

## Phase 4 — Intégrations paie & notifications

- [ ] Connecteur paie (interface d’abord)
- [ ] E-mail transactionnel (Graph ou SMTP)
- [ ] Audit trail et journalisation

## Hors scope volontaire (prototype)

- Paie réelle, signatures électroniques légales, DPAE, déclarations sociales automatisées.
