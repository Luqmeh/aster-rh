# Alignement présentation Conseil ↔ ASTER

**Source :** `/home/luq/Downloads/ASTER_Presentation_Conseil_FR_v2.pptx` (15 slides, nov. 2026)  
**Ré-audit fidélité :** 11 novembre 2026 (après `9914172` calculs — **sans** refonte accrual dans cette passe)  
**Périmètre :** workflows, terminologie, rôles, indicateurs, règles produit PPT.

## 1. Comparaison slide par slide

| Slide | Thème | Statut | Évidence / écart |
|------:|-------|--------|------------------|
| 01 | 3 rôles | **MATCH** | Collaborateur · Responsable RH · Senior Manager |
| 02 | Point d’entrée unique | **MATCH** | Nav par rôle, self-service + RH + décision |
| 03 | Dashboard CP/RTT, calendrier, notifs | **MATCH** | Compteurs CP/RTT ; calendrier ; demandes ; notifs ; raccourcis congé / absence / télétravail / documents |
| 04 | Absence + documents | **MATCH** | `/absences` (dates, catégorie, commentaire) ; `/documents` demande / dispo / historique |
| 05 | Télétravail 2/12 paramétrable | **MATCH** | Limites produit 2 j/sem · 12 j/mois ; env `ASTER_TELEWORK_*` |
| 06 | Calendrier RH partagé | **MATCH** | Congés, télétravail, statuts, fériés, absences |
| 07 | Espace RH sans validation | **MATCH** | Bannière RH ; files lecture seule ; historique récent ; lien Reporting |
| 08 | Annuaire | **MATCH** | Recherche, filtres, fiches (RH/Chef) |
| 09 | Gouvernance | **MATCH** | RH sans Approuver/Refuser ; Chef décide ; « En attente de validation » |
| 10 | Confidentialité médicale | **MATCH** | Justificatifs RH-only ; Chef vue opérationnelle |
| 11 | Reporting + Excel | **MATCH** | Filtres, KPIs, charts, centre d’exports |
| 12 | Fériés & récupération | **MATCH** | Corrections calendrier ; compteurs en attente / approuvées / à confirmer / créditées |
| 13 | Non opérationnel | **MATCH** | Notes de frais, rémunération, formation, mobilité + PlannedBanner |
| 14 | Stack | **MATCH** | Next.js, services, Prisma/Supabase, Vercel |
| 15 | Synthèse | **N/A** | Message Conseil |

## 2. Manques / incohérences restantes (fidélité)

1. Captures PPT avec sites FR / badge Cadre vs données démo Maroc actuelles (volontaire).
2. Recrutement opérationnel alors que certaines captures le marquent « BIENTÔT » (slide 13 ne le liste pas hors périmètre).
3. Pas d’écran RH de saisie des plafonds télétravail (config via env uniquement).
4. Module « Droits à congés » hors slides — utile RH, hors script Conseil strict.

## 3. Calculs non spécifiés dans la présentation

(Ne pas inventer dans une passe fidélité.)

- Taux d’acquisition CAP / ancienneté / report (hors 2/12 télétravail).
- Alimentation du compteur RTT affiché.
- Régime légal complet du travail férié (au-delà de la règle produit 1 h = 1 h).
- Plafonds congés spéciaux.
- Paie / CNSS / SIRH.

## 4. Correctifs de fidélité (cette passe)

- Raccourcis dashboard : congé vs déclaration d’absence séparés ; libellés PPT.
- Page absences : titre / description alignés déclaration.
- Administration : historique récent congés/télétravail + copy récupération « présentation Conseil ».
- Rappel justificatifs sans promesse de paie.

Voir `docs/PROGRESS.md`.
