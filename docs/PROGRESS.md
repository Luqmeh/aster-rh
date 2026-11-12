# ASTER — Rapport de progression

**Date / heure :** 12 novembre 2026 ~02:27 UTC  
**Branche :** `main`  
**Sujet :** Follow-up — masquage libre-service férié sur le calendrier  
**État :** **FAIT** — typecheck OK ; commit à pousser.

---

## Contexte

Après `671ebd1` (séparation management / Collaborateur), l’exploration du code a signalé un reste UI : le calendrier montrait encore `WorkOnHolidayRequestForm` / déclaration d’heures sans filtre de rôle (le backend refusait déjà).

## Correctif

- `HrCalendar` : formulaires férié perso uniquement si `canSubmitWorkOnHolidayRequest(role)`.
- Actions Chef (approbation / crédit) inchangées.
- Passage explicite de `role={session.role}` depuis tableau de bord et télétravail (évite le défaut `collaborateur`).

## Fichiers

- `src/components/calendar/hr-calendar.tsx`
- `src/app/(app)/tableau-de-bord/page.tsx`
- `src/app/(app)/teletravail/page.tsx`
- `docs/PROGRESS.md`

## Vérifs

- `permissions` + `management-self-service-guard` : 10 passed  
- `npm run typecheck` : OK  

Production non modifiée. Pas de seed.

## Prochaine étape

Push + smoke calendrier en tant qu’Amel / Kenza (pas de formulaire férié perso) vs Collaborateur onboardé.
