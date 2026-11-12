# ASTER — Rapport de progression

**Date / heure :** 12 novembre 2026 ~02:25 UTC  
**Branche :** `main`  
**Sujet :** Séparation comptes management / libre-service Collaborateur  
**État :** **FAIT** — tests / typecheck / lint / build OK ; prêt push.

---

## Objectif atteint

Trois expériences distinctes sans retirer de modules :

| Rôle (enum DB) | Libellé | Libre-service personnel | Management |
|----------------|---------|-------------------------|------------|
| `chef_de_projet` | Senior Manager | **Retiré** | Validations + admin (inchangé) |
| `admin_rh` | Responsable RH | **Retiré** | Admin RH, lecture demandes, **sans** approve |
| `collaborateur` | Collaborateur | **Complet** | Non |

Production (Amel / Kenza) **non touchée** : pas de seed, pas de reset, pas de changement de mots de passe / IDs.

---

## Permissions centralisées (`permissions.ts`)

Retiré de CHEF + RH :  
`request.leave.submit`, `request.telework.submit`, `document_request.submit`, `work_on_holiday.submit`, `work_absence.submit` (+ `view_own` perso associés).

Conservé : `*.view_all`, `*.approve` (Chef), `document_request.process`, HR import, reporting, annuaire, lifecycle, etc.

Helpers ajoutés : `canSubmitLeaveRequest`, `canSubmitTeleworkRequest`, `canSubmitDocumentRequest`, `canSubmitWorkOnHolidayRequest`, `canUseEmployeeSelfService`.

---

## Enforcement serveur

| Service | Changement |
|---------|------------|
| `leave-service` | Refuse submit si pas `request.leave.submit` |
| `telework-service` | Refuse submit / update / withdraw perso |
| `document-request-service` | Déjà gated sur `document_request.submit` |
| `work-absence-service` | Déjà gated sur `work_absence.submit` |
| `work-on-holiday-service` | submit + `declareActualHours` gated |

---

## UX (modules conservés)

- Dashboard : raccourcis management vs libre-service selon rôle.
- Congés / Télétravail / Absences / Documents : formulaires perso masqués pour management + empty states explicites ; files de validation / admin intactes.
- Navigation / onglets : **inchangés**.

---

## Onboarding

- Default role provisionné : `collaborateur` (`employee-provisioning-service`).
- `mustChangePassword` / flux premier login : inchangés (tests password-change OK).
- Pas d’attribution automatique Senior Manager / RH.

---

## Tests

| Suite | Résultat |
|-------|----------|
| Vitest complet | **322 passed**, 1 skipped (61 files) |
| `permissions.test.ts` | 4 passed (management sans submit) |
| `management-self-service-guard.test.ts` | **nouveau** — 6 passed (backend refuse Chef/RH, collab OK, approve Chef OK, RH ne décide pas) |
| `approval-workflow.test.ts` | 11 passed |
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK (`ASTER_BUILD_WITHOUT_DB=1`) |

---

## Fichiers principaux

- `src/domain/rules/permissions.ts` (+ test)
- `src/application/services/{leave,telework,work-on-holiday}-service.ts`
- `src/application/services/management-self-service-guard.test.ts` (nouveau)
- `src/app/(app)/{tableau-de-bord,conges,teletravail,absences,documents}/page.tsx`
- Docs : `ROLE_PERMISSIONS.md`, `ASTER_SCOPE.md`, `DEMO_GUIDE.md`, `HR_REQUIREMENTS.md`, `PRESENTATION_ALIGNMENT.md`

**Dépendances :** aucune ajoutée.  
**Migrations / seed Production :** aucun.

---

## Known issues

- Messages métier texte « Chef de projet » encore présents dans certains services (hors `roleLabel`) — cosmétique, hors périmètre.
- Enum DB non renommé en `senior_manager` / `hr_admin` (volontaire).

---

## Prochaine étape

Déployer `main` sur Vercel Production (build auto) puis smoke-test login Amel / Kenza : modules visibles, formulaires perso absents, validations Chef OK.
