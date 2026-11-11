# Matrice des politiques de calcul — ASTER Maroc

**Date :** 11 novembre 2026  
**Sources légales prioritaires :** Loi 65-99 (Code du travail), PDF Adala consolidé 26/10/2011 — https://adala.justice.gov.ma/api/uploads/2024/04/30/code%20du%20travail-1714463246806.pdf  
**Produit :** `ASTER_Presentation_Conseil_FR_v2.pptx` + pratique entreprise communiquée (2 j/mois CAP).

> Ne constitue pas un avis juridique. Distinguer minimum légal ≠ avantage entreprise.

| Catégorie | Règle légale / source | Règle entreprise / produit | Implémentation actuelle | Formule requise | Statut vérif. | Décision RH restante |
|-----------|----------------------|----------------------------|-------------------------|-----------------|---------------|----------------------|
| CAP minimum adulte | Art. 231 : 1,5 j travail effectif / mois de service | — | `MA_ANNUAL_LEAVE_STATUTORY` | 1,5 × mois service | **Légal documenté** | — |
| CAP <18 ans | Art. 231 : 2 j / mois | — | via `birthDate` | 2 × mois service | **Légal documenté** | birthDate RH |
| CAP entreprise | — | **2 j/mois = total** (pas 1,5+2) | `MA_ANNUAL_LEAVE_COMPANY` | `max(2, statutaire)` / mois | **Produit / À confirmer RH** | Source formelle + `hr_configured` |
| Ancienneté | Art. 232 : +1,5 j / 5 ans, max 30 | Appliquée sur base applicable | `annualEntitlementDays` | `min(30, base+1,5×⌊ans/5⌋)` | **Légal + interaction entreprise À confirmer** | Ancienneté sur base 24 ou autre ? |
| Ouverture 6 mois | Art. 231 / 237 | Idem | Gate non postable | Continuité ≥ 6 mois | **Légal documenté** | — |
| Mois de service | Art. 238 : 26 j / 191 h / 208 h | Idem mesure | `morocco-annual-leave` | Voir moteur | **Légal documenté** | Timesheet TP |
| Jours congé demandés | Art. 236 (effectif) + art. 235 (fériés pendant congé) | Lun–ven, demi-journées, fériés exclus | `countBusinessDays` + fériés MA | Ouvrés − fériés − demi | **Partiel** | Week-end site ; art. 235 extension |
| Réservation / conso | — | Pending réserve ; approval consomme 1× | Ledger + pending | Ledger − pending ; conso idempotente | **Produit OK** | — |
| RTT | Pas de RTT statutaire MA identifié | Compteur UI ; pas d’acquisition auto | Solde ledger historique | N/A acquisition | **À valider RH** | Avantage employeur ? |
| Congés spéciaux | Dispositions familiales Code (à cartographier) | Catalogue ASTER plafonds indicatifs | `special-leave-entitlements` | Par catégorie | **À valider RH** | Plafonds formels |
| Télétravail | Non statutaire CAP | **2 j/sem · 12 j/mois** PPT | `telework-limits` + validation | Configurable env | **Produit confirmé** | UI config RH |
| Récup. férié | Régime légal travail férié **non exhaustif ici** | PPT : **1 h = 1 h** récup | `hoursToRecoveryDays` | h / horaire journalier | **Produit** ; légal **À valider** | Majoration / repos légal |
| Report CAP | Art. 240 accord 2 années | Idem process | Carryover admin | Accord mutuel | **Légal + process** | Registre art. 246 |
| Reporting | — | Indicateurs PPT | Services partagés | Même source soldes | **Produit** | — |

## Posting Production

| Politique | Auto-post |
|-----------|-----------|
| `MA_ANNUAL_LEAVE_COMPANY` (`requires_hr_decision`) | **Non** |
| `MA_ANNUAL_LEAVE_STATUTORY` (`guide_documented`) | **Non** (seul `hr_configured`) |
| RTT MA | **Non** (aucune politique active) |

Aucune migration destructive. Aucun rewrite ledger. Aucun bulk accrual Production dans cette phase.
