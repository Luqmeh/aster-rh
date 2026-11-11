# Politique RH — département Maroc (ASTER)

**Périmètre :** PKF Arsilon — département Maroc uniquement.  
**Langue UI :** français (`fr-MA`).  
**Vérification documentaire :** 11 novembre 2026.

> Ne remplace pas un avis juridique. Les règles marquées **À valider** ne sont pas postées automatiquement.

## 1. Source officielle consultée

| Champ | Valeur |
|-------|--------|
| Titre | Loi n° 65-99 formant Code du travail |
| URL | https://adala.justice.gov.ma/api/uploads/2024/04/30/code%20du%20travail-1714463246806.pdf |
| Éditeur | Adala — Ministère de la Justice |
| Version PDF | Consolidée au **26 octobre 2011** |
| Amendements CAP repérés post-2011 | Aucun amendement spécifique art. 231–245 identifié lors de la recherche du 11/11/2026 — **vigilance** si textes ultérieurs |
| Statut | Statutaire (ordre public social + dispositions plus favorables possibles) |

## 2. Matrice de validation CAP (art. 231–245)

| Rule | Legal / policy source | Current ASTER | Required change | Validation status | Open question |
|------|----------------------|---------------|-----------------|-------------------|---------------|
| Accrual adulte 1,5 j travail effectif / mois de service | Art. 231 | Moteur `morocco-annual-leave` | — | **Documenté (PDF Adala)** | — |
| Accrual <18 ans : 2 j / mois de service | Art. 231 | Via `birthDate` | Renseigner birthDate RH | **Documenté** | Si birthDate absent → adulte par défaut (warning) |
| Ouverture du droit après 6 mois de service continu | Art. 231 + 237 | Gate preview/post | — | **Documenté** | Accrual calculé avant 6 mois mais non postable auto |
| Majoration +1,5 j / période entière de 5 ans | Art. 232 | Inclus dans annuel / 12 | — | **Documenté** | Appréciation « continue ou non » : années depuis embauche |
| Plafond 30 j de travail effectif | Art. 232 | `MA_MAX_ANNUAL_LEAVE_DAYS` | — | **Documenté** | — |
| CDD : congé pris avant fin de contrat | Art. 233 | Warning preview | Processus RH départ CDD | **Documenté / process RH** | Indemnité compensatrice (art. 251 s.) hors paie ASTER |
| Ancienneté appréciée au départ en congé / fin contrat | Art. 234 | Annuel à `asOfDate` période | — | **Documenté** | Recalcul au jour exact de départ congé : amélioration future |
| Fêtes payées / fériés pendant congé allongent le congé | Art. 235 | Non dans durée demande | Étendre `countBusinessDays` | **À valider produit** | Implémentation consommation |
| Maladie non comptée dans le CAP | Art. 235 al. 2 | Séparé (WorkAbsence) | — | **Documenté (process)** | — |
| Définition jours de travail effectif | Art. 236 | Hors week-end sam–dim + fériés fournis | Week-end par site | **Documenté / config site** | Ven–sam vs sam–dim |
| Service continu malgré suspensions art. 32 (1–5) | Art. 237 | Emploi lié par contrat | Absences suspendues non encore déduites du service | **Partiel** | Brancher WorkAbsence / art. 32 |
| Mois = 26 j effectifs | Art. 238-1 | Conversion utilisée (mois partiel / sans heures) | — | **Documenté** | — |
| Mois = 191 h (non agricole) / 208 h (agricole) | Art. 238-2 | Temps plein 44 h ≈ 191 h/mois ; heures période pour TP | `activitySector`, heures | **Documenté** | Heures réelles timesheet non branchées |
| Périodes assimilées (art. 239) | Art. 239 | Non exhaustif | Intégrer absences assimilées | **À valider RH** | Mapping WorkAbsence |
| Fractionnement / cumul 2 années par accord | Art. 240 | Carryover admin + accord | Registre congés | **Documenté / process** | UI registre 246 |
| Pas d’expiry auto statutaire | Art. 240 | Pas d’expiry CAP auto | Ne pas réintroduire expiry FR | **Documenté** | Politique interne plus stricte ? |
| Organisation / dates (244–245) | Art. 244–245 | Hors moteur accrual | Process employeur | **Hors scope accrual** | — |
| Temps partiel | Art. 238-2 | Heures obligatoires sinon blocage | Saisir heures période | **Documenté** | — |
| Joiners / leavers | Art. 231/238 | Chevauchement période + j effectifs | — | **Documenté** | — |
| Solde de tout compte / indemnité compensatrice | Art. 251 s. | Non automatisé | Données auditables seulement | **Hors scope paie** | — |
| RTT | — | Désactivé | Ne pas réactiver FR | **N/A Maroc** | Avantage employeur ? |

## 3. Modèle de calcul ASTER (implémenté)

1. **Statutaire** art. 231 : 1,5 (adulte) / 2 (<18) — politique `MA_ANNUAL_LEAVE_STATUTORY` (référence).
2. **Entreprise** : **2 j/mois** (`MA_ANNUAL_LEAVE_COMPANY`) = **total** applicable ASTER, **non cumulé** avec 1,5. Status `requires_hr_decision`.
3. **Annuel applicable** art. 232 : `min(30, taux_applicable×12 + 1,5×⌊années/5⌋)`.
4. **Mois de service** art. 238 : heures / 191|208 ; sinon équivalence temps plein ; sinon jours effectifs / 26.
5. **Crédit période** = mois de service × (annuel applicable / 12).
6. **Posting auto** uniquement si politique `hr_configured` + statut `calculated` + ≥ 6 mois — **pas** de bulk Production tant que l’entreprise n’est pas confirmée.
7. **Ledger** append-only : `conges_payes_en_acquisition` / `accrual`.

## 4. Autres absences / télétravail / fériés

Inchangés vs Morocco-first : maladie RH-only docs ; télétravail = politique produit ; calendrier `morocco-holidays.ts`.

## 5. Questions ouvertes

1. Week-end réel par site (impact art. 236/238-1).
2. Brancher heures réelles / timesheet pour art. 238-2.
3. Assimilation art. 239 via absences.
4. Extension durée de congé pour fériés pendant absence (art. 235).
5. Registre des congés (art. 246) et process CDD art. 233.
6. Confirmer qu’aucun amendement post-2011 ne modifie art. 231–245 pour le cabinet.
