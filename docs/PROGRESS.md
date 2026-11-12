# ASTER — Rapport de progression

**Date / heure :** 12 novembre 2026 ~01:40 UTC  
**Branche :** `main`  
**Sujet :** Inventory live Production avant purge comptes démo  
**État :** **STOP** — inspection seule ; exécution destructive **non autorisée** ; accès DB live **indisponible**.

---

## Phase 1 / inspection (aucun mutate)

### Cible déclarée (intention utilisateur)

| Élément | Valeur |
|---------|--------|
| Application | `https://aster-rh.vercel.app` |
| `ASTER_MODE` | `demo` (confirmé via variables non-secrètes Production) |
| `ASTER_PERSISTENCE` | `prisma` (idem) |
| Déploiement Ready | `dpl_66McZUV8Mv789WtdEMpZhXrCJ6JQ` (inspect) |

Ceci est l’environnement de démonstration public **visé**, mais **pas** encore une autorisation de purge.

### Accès base live

Tentatives sécurisées (sans afficher de secrets) :

1. `vercel env pull` Production → 17 secrets remplacés par `[SENSITIVE]`.
2. `vercel env run -e production -- …` → mêmes secrets absents ; message CLI : *Secret values cannot be pulled… Define them in a local .env file.*
3. Workspace local `.env.local` → **pas** d’URL Postgres (seulement jeton OIDC) ; mode effectif local = **memory**.

**Manque exact :** une source locale utilisable (hors chat) des variables secrètes Production, notamment `POSTGRES_PRISMA_URL` / `DATABASE_URL` (et idéalement `POSTGRES_URL_NON_POOLING`), injectables via fichier gitignored / hors repo, **sans** les coller dans le chat.

Sans cela, aucun `SELECT` Prisma/Postgres Production n’est possible depuis cet agent.

### Inventaire live

**Non réalisé.** Aucune ligne `UserAccount` / `Employee` Production n’a été lue.

### Inventaire provisoire (code seed uniquement — non confirmé live)

| Account ID | Employee ID | Email | Rôle | Intention |
|------------|-------------|-------|------|-----------|
| `user-julien` | `emp-julien` | `youssef.alaoui@demo.aster-rh.local` | `chef_de_projet` | Préserver → Amel DAAB |
| `user-camille` | `emp-camille` | `sara.benali@demo.aster-rh.local` | `admin_rh` | Préserver → KENZA RAFIQ |
| `user-lea` | `emp-lea` | `imane.chraibi@demo.aster-rh.local` | `collaborateur` | Purge login proposée |

Directory-only (seed, **à conserver** pour l’instant) : `emp-thomas`, `emp-ines`, `emp-hugo`, `emp-sarah`, `emp-marc`.

### Incident opérationnel (corrigé)

Une invocation CLI a créé par erreur le projet Vercel `aster-prod-readonly-inventory-run`.  
**Action :** projet **supprimé** immédiatement (`vercel remove … --yes`). Aucune écriture DB ASTER.

### Opérations destructives

**Aucune.** Pas de rename, delete, migrate, seed, ni modification de données.

## Prochaine étape exacte

Débloquer l’accès Postgres Production pour l’agent (ex. `vercel env pull` avec un compte/token autorisé à lire les secrets, ou fichier env local gitignored prérempli hors chat), puis **rejouer uniquement l’inventory READ-ONLY** et attendre une **approbation explicite** du plan de purge live avant toute mutation.
