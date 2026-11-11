# Politique RH — département Maroc (ASTER)

**Périmètre :** PKF Arsilon — département Maroc uniquement.  
**Langue UI :** français (`fr-MA`).  
**Vérification documentaire :** 11 novembre 2026.

> Les règles ci-dessous ne remplacent pas un avis juridique. Toute valeur non validée par RH/juridique Maroc reste **« À valider par RH »** et ne doit pas être postée automatiquement au ledger.

## 1. Sources prioritaires

| Priorité | Source | Usage |
|----------|--------|--------|
| 1 | Code du travail marocain — Loi n° **65-99** | Congé annuel, durée du travail, absences |
| 2 | Publications officielles / ministère de l’Emploi | Confirmations, décrets |
| 3 | CNSS (`https://www.cnss.ma`) | Processus sociaux (ASTER n’intègre pas les déclarations) |
| 4 | Calendrier officiel des fêtes (maroc.ma / MMSP) | Jours fériés |
| 5 | Convention collective applicable **si** confirmée pour l’employeur MA | Avantages complémentaires |
| 6 | Politique interne écrite du département Maroc | Règles employeur |

**Interdit :** utiliser le guide RH France / CAVEC / convention collective des cabinets d’expertise comptable FR comme autorité pour le Maroc.

### Accès sources lors de cette itération

- Texte consolidé officiel de la loi 65-99 (articles exacts) : **non récupéré en intégralité** via les fetch automatisés (PDF ILO / portails partiellement inaccessibles).
- Les articles de congé annuel ci-dessous sont donc consignés comme **baseline couramment citée**, statut **À valider par RH** avant toute configuration `hr_configured`.

## 2. Congé annuel payé (baseline à valider)

| Champ | Valeur proposée | Base | Statut |
|-------|-----------------|------|--------|
| Nom | Congé annuel payé (CAP) | Loi 65-99 — dispositions sur le congé annuel (souvent citées art. 231 et s.) | **À valider par RH** |
| Acquisition | 1,5 jour ouvrable / mois de service effectif ≈ 18 j / an | Citations courantes du Code du travail | **À valider par RH** |
| Mineurs | Régime distinct parfois cité (2 j/mois) | Idem | **À valider par RH** |
| Ancienneté | Majoration périodique (souvent +1,5 j / 5 ans) | Idem | **À valider par RH** |
| RTT | **N’existe pas** comme droit statutaire MA dans ASTER | — | Pas d’acquisition auto |
| Temps partiel / entrées-sorties | Pas de formule inventée | — | Preview bloquée si non validé |
| Report / expiry | Non configuré | Politique interne MA absente | **À valider par RH** |

Implémentation code : politique `MA_ANNUAL_LEAVE_STATUTORY`, `validationStatus=requires_hr_decision`, **quantity postable = 0** tant que non `hr_configured`.

## 3. Autres absences

| Catégorie | Traitement ASTER | Statut |
|-----------|------------------|--------|
| Maladie | Déclaration + justificatif ; docs médicaux RH-only | Workflow conservé ; CNSS **hors** intégration |
| Maternité / paternité / parental | Types existants ; barèmes non inventés | **À valider par RH** |
| Événementiels / spéciaux | Catalogue existant marqué non statutaire MA | **À valider par RH** |
| Sans solde | Demande sans solde ledger | OK produit |
| Récupération férié travaillé | Ledger `recuperation` | OK produit (opérationnel) |

## 4. Durée du travail (référence d’alerte)

| Règle | Valeur | Statut |
|-------|--------|--------|
| Durée légale de référence souvent citée | 44 h / semaine | **À valider** pour le site MA réel |
| ASTER | Alerte si `weeklyContractHours` renseigné et ≠ référence config | Pas de calcul paie |

## 5. Télétravail

Limites 2 j/semaine et 12 j/mois = **politique produit** (présentation Conseil nov. 2026), **pas** une obligation du Code du travail. Paramétrables ; confirmation département Maroc requise.

## 6. Jours fériés

Dataset `src/data/morocco-holidays.ts` (sources maroc.ma / MMSP). Fuseau `Africa/Casablanca`. Fêtes religieuses hijri : `provisional` jusqu’à confirmation Habous.

## 7. Questions ouvertes (RH Maroc)

1. Confirmer articles exacts + barème congé annuel / ancienneté applicables au cabinet.
2. Existe-t-il un avantage type RTT ou jours employeur au Maroc ?
3. Planning week-end réel (ven–sam vs sam–dim) par site.
4. Convention collective ou accord d’entreprise applicable.
5. Processus CNSS maladie : quels documents ASTER doit seulement **stocker** vs déclarer.
6. Organigramme définitif vs départements démo présentation.
