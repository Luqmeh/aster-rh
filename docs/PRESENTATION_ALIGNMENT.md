# Alignement présentation Conseil ↔ ASTER

**Source :** `/home/luq/Downloads/ASTER_Presentation_Conseil_FR_v2.pptx` (15 slides, nov. 2026)  
**Audit :** 11 novembre 2026  
**Périmètre :** fidélité produit (parcours, terminologie, rôles, indicateurs) — **pas** refonte des calculs légaux.

## 1. Comparaison slide par slide

| Slide | Thème | Statut | Évidence / écart |
|------:|-------|--------|------------------|
| 01 | Titre / 3 rôles | **MATCH** | Collaborateur · Ressources humaines · Chef de projet (`permissions.ts`, auth) |
| 02 | Enjeu point d’entrée | **MATCH** | Portail unique, accès par rôle (`navigation.ts`) |
| 03 | Tableau de bord CP/RTT | **MATCH** | Compteurs CP/RTT, demandes, calendrier, notifications (`tableau-de-bord`) |
| 04 | Absences + documents | **PARTIAL→corrigé** | Documents OK ; absences via `/absences` ; maladie retiré du formulaire Congés |
| 05 | Télétravail 2 j/sem · 12 j/mois | **MATCH** | Limites produit affichées ; validations Chef |
| 06 | Calendrier RH partagé | **MATCH** | Congés, télétravail, statuts, fériés (`calendrier`) |
| 07 | Espace RH sans validation | **MATCH** | Bannière RH + boutons absents si `admin_rh` |
| 08 | Annuaire | **MATCH** | Recherche, filtres, fiches (RH/Chef) |
| 09 | Gouvernance validations | **MATCH** | RH consulte ; Chef décide ; libellé « En attente de validation » |
| 10 | Absences / confidentialité médicale | **MATCH** | Justificatifs RH-only ; Chef vue opérationnelle |
| 11 | Reporting + Excel | **MATCH** | Filtres, KPIs, graphiques, centre d’exports |
| 12 | Temps & récupération fériée | **MATCH** | Corrections calendrier + compteurs WOH sur Administration |
| 13 | Périmètre / non opérationnel | **MATCH** | Notes de frais, rémunération, formation, mobilité = PlannedBanner |
| 14 | Fondations techniques | **MATCH** | Next.js, services, Prisma/Supabase, Vercel |
| 15 | Synthèse | **N/A** | Message Conseil |

## 2. Manques / incohérences restantes (fidélité)

1. **Captures PPT anciennes** : sites Lyon/Paris et badge « Cadre » sur certaines slides ; données démo actuelles = Maroc (`Casablanca`, `category=non_applicable`). Conservé volontairement (périmètre Maroc).
2. **Recrutement** : slides texte (13) ne le listent pas comme non finalisé ; certaines captures le marquent « BIENTÔT ». Module **conservé opérationnel** (reporting inclut recrutements).
3. **Historique RH congés/télétravail** : file d’attente admin + lien Reporting ; pas encore une liste « historique » dédiée sur Administration.
4. **Règles télétravail « paramétrables »** : message produit présent ; **pas** d’écran de configuration RH des plafonds (hardcodés 2/12).
5. **Enum `en_attente_rh`** : conservé techniquement ; libellé UI unifié « En attente de validation » (comme les captures).

## 3. Calculs dont la règle entreprise n’est **pas** dans la présentation

Ne pas inventer / ne pas remplacer silencieusement :

- Taux d’acquisition CAP / ancienneté / report (hors règles produit explicites 2/12 télétravail).
- Existence et acquisition RTT Maroc (la présentation **affiche** un compteur RTT ; la règle d’alimentation n’est pas spécifiée).
- Formule de crédit récupération fériée (ASTER utilise 1 h = 1 h — hors PPT).
- Plafonds congés spéciaux, jours ouvrés, demi-journées métier.
- Barème heures supplémentaires / CNSS / paie (hors scope).

## 4. Correctifs de fidélité appliqués (cette itération)

Voir `docs/PROGRESS.md`.
