# ASTER — Rapport de progression

**Date / heure :** 12 novembre 2026 ~02:07 UTC  
**Branche :** `main`  
**Sujet :** Exécution approuvée — purge annuaire Production → 2 employés  
**État :** **FAIT** — vérifié live sur Supabase `omprtbhqjdhnyfhwboho`.

---

## Exécution

- Cible : Production `omprtbhqjdhnyfhwboho.supabase.co` (préflight host OK).
- Méthode : transaction Prisma unique + deletes storage ciblés (pas de `TRUNCATE` / seed / reset).
- Préflight : counts + IDs + historique + FK **alignés** sur l’inventory approuvé → dry-run `passed` → execute.
- Route / preview d’exécution **retirés** après coup.

### Résultat live

| Check | Résultat |
|-------|----------|
| Employee | **2** — `emp-julien` Amel DAAB · Senior Manager · `amel.daab@demo.aster-rh.local` |
| UserAccount | **2** — `user-julien` (`chef_de_projet`) · `user-camille` (`admin_rh`) |
| Kenza | `emp-camille` KENZA RAFIQ · Responsable RH · `kenza.rafiq@demo.aster-rh.local` |
| Password hashes | **inchangés** (sha256 préfixe `e9b204d5eb57` avant = après) |
| bcrypt runtime | `ASTER_SEED_PASSWORD` absent du runtime preview → compare plaintext non exécutée ; hashes préservés |
| Historique Amel/Kenza | soldes / ledger / notifs / work-on-holiday = **0** |
| Employés / comptes purgés | 8 + 3 absents ; 0 orphelins leave sur IDs deleted |
| HrImportBatch | **0** (5 lots + 1 objet storage + doc perso Léa supprimés ; 0 erreur storage) |
| RecruitmentCandidate / Event | **2 / 9** conservés ; `createdByEmployeeId = emp-camille` |
| OrganizationUnit / docs société | **6 / 2** intactes |

### Rôles techniques vs libellés

Enum Prisma `DemoRole` : toujours `chef_de_projet` / `admin_rh` (pas de valeurs `SENIOR_MANAGER` / `HR_ADMIN` en base).  
Libellés produit mis à jour : `roleLabel` + sélecteurs UI → **Senior Manager** / **Responsable RH**.  
Migration enum dédiée = itération ultérieure si IDs littéraux requis en DB.

---

## Fichiers applicatifs modifiés (post-cleanup)

| Fichier | Changement |
|---------|------------|
| `src/domain/rules/permissions.ts` | Labels Senior Manager / Responsable RH |
| `src/domain/rules/permissions.test.ts` | Expectations labels |
| `src/components/modules/lifecycle-role-controls.tsx` | Options rôle |
| `src/components/modules/employee-onboard-form.tsx` | Options rôle |
| `docs/PROGRESS.md` | Ce rapport |

Aucune migration Prisma dans ce lot. Aucune credential commitée. `docs/git ssh.txt` non lu / non touché.

---

## Tests

- `vitest run src/domain/rules/permissions.test.ts` — **4 passed**

---

## Prochaine étape recommandée

1. Connexion manuelle Production avec les mots de passe existants Amel / Kenza (confirmer UX).  
2. (Optionnel) Migration enum `chef_de_projet`→`senior_manager` / `admin_rh`→`hr_admin` + refactor permissions.  
3. Remplacer les messages métier restants « Chef de projet » dans les services/UI hors `roleLabel`.
