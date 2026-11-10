# Exigences RH — PKF Arsilon

**Source authoritative :** guide RH PKF Arsilon (document confidentiel, **non versionné** dans ce dépôt).

Ce fichier doit être mis à jour avec les **références de pages** du guide dès qu’elles sont saisies.  
Toute valeur chiffrée non confirmée est marquée **HYPOTHÈSE DE DÉMONSTRATION**.

---

## 1. Cadre vs non-cadre

| Sujet | Statut | Notes / source |
|-------|--------|----------------|
| Distinction des régimes de temps de travail | **À documenter** | Préservée dans le modèle (`Employee.category`) |
| Forfait jours (cadres) | **À documenter** | Module Temps de travail planifié |
| Suivi horaire (non-cadres) | **À documenter** | Module Temps de travail planifié |
| Droits RTT selon catégorie | **HYPOTHÈSE DÉMO** | Cadre : 10 RTT/an ; non-cadre : 8 RTT/an — *à remplacer par le guide* |

Code : `src/domain/rules/leave.ts` → `defaultAnnualEntitlement`.

---

## 2. Congés payés

| Sujet | Statut | Notes / source |
|-------|--------|----------------|
| Droit annuel CP | **HYPOTHÈSE DÉMO** | 25 jours — *confirmer page guide* |
| Calcul des jours (ouvrés lun–ven) | **HYPOTHÈSE DÉMO** | Simplifié ; hors jours fériés & conventions locales |
| Demi-journées | **Implémenté (démo)** | Flags `halfDayStart` / `halfDayEnd` |
| Circuit validation | **HYPOTHÈSE DÉMO** | Collaborateur → Chef de projet (RH en lecture seule) |
| Contexte collaborateur à la validation | **Implémenté (démo)** | Panneau soldes / historique à côté de chaque demande (`leave-approval-context`) — sans inventer de barème hors modèle |
| Types d’absence (CP/RTT) | **Démo** | CP, RTT, sans solde, maladie, exceptionnel, parental (LeaveRequest) |
| Arrêts / absences spéciales | **Guide + workflow ASTER** | Module `WorkAbsence` — voir §7 |

Références guide à compléter :

- Page ___ : acquisition / prise des CP  
- Page ___ : RTT  
- Page ___ : absences exceptionnelles / parentales  

---

## 3. Télétravail

**Source guide RH : page 106**

| Sujet | Statut | Notes / source |
|-------|--------|----------------|
| Plafond mensuel | **Implémenté** | Jusqu’à **12 jours / mois** (p.106) |
| Présence / temps de travail | **Documenté** | Minimum **80 %** d’un temps plein (p.106) — cadre d’éligibilité, non recalculé numériquement dans la démo |
| Compatibilité des tâches | **Implémenté (flag)** | `Employee.teleworkEligible` — message clair si faux |
| Continuité de service | **Documenté** | Condition p.106 ; refus Chef de projet possible avec motif |
| Planification hebdomadaire UI | **Implémenté** | **Maximum 2 jours / semaine** dans le plan mensuel |
| Pas de week-end | **Implémenté** | Validation domaine |
| Conflits congés approuvés | **Implémenté** | Intersection dates refusée |
| Circuit validation | **Implémenté** | Collaborateur → Chef de projet (motif obligatoire en cas de refus ; RH sans décision) |

Code :

- `src/domain/rules/telework-monthly.ts`
- `src/application/services/telework-service.ts`

Références guide :

- **Page 106** : 12 jours/mois, 80 % temps plein, tâches compatibles, continuité de service  

---

## 4. Organisation & rôles applicatifs

| Rôle démo | Intention |
|-----------|-----------|
| Collaborateur | Consultation + demandes personnelles |
| Chef de projet | Validations globales + administration RH |
| Administrateur RH | Vue transverse + validations de démo |

Le mapping vers les groupes Microsoft Entra ID reste à définir (`docs/INTEGRATIONS.md`).

---

## 5. Documents & confidentialité

- Aucun document RH confidentiel réel dans le dépôt.
- Ne jamais committer le guide RH source.

### Demandes documentaires collaborateur (ASTER)

| Sujet | Statut | Notes / source |
|-------|--------|----------------|
| Bulletins de paie | **Guide p.65–66** | Diffusion PeopleDoc — **pas** de demande de génération RH dans ASTER |
| Mutuelle / santé complémentaire | **Guide p.54** | Procédures Helium (hors workflow documentaire ASTER) |
| Mises à jour dossier personnel | **Guide p.69** | Formulaires Kammi (hors catalogue ASTER) |
| Attestation annuelle CNCC | **Guide p.81** | Professionnels CAC éligibles |
| Certificats de réussite / primes | **Guide p.93** | Remise RH pour primes applicables |
| Catalogue de demandes ASTER | **HYPOTHÈSE DÉMO** | Types proposés dans l’UI **non** présentés comme inventaire exhaustif du guide |
| Éligibilité CNCC (démo) | **HYPOTHÈSE DÉMO** | Intitulé de poste contenant « CAC » ou « commissaire » |
| Documents de départ | **HYPOTHÈSE DÉMO** | Proposés si statut `parti` ou `inactif` avec date de départ |

Code : `src/domain/rules/document-requests.ts`, `src/application/services/document-request-service.ts`.

### Jours fériés marocains & récupération

| Sujet | Statut | Notes / source |
|-------|--------|----------------|
| Calendrier national / religieux | **Sources officielles** | maroc.ma ; MMSP — dataset versionné `src/data/morocco-holidays.ts` |
| Dates religieuses futures | **Provisoires** | Sous réserve annonce Ministère des Habous |
| RTT annuels | **Guide** | Arrangements RTT existants — non modifiés par ce module |
| Récupération 1 h travaillée = 1 h créditée | **RÈGLE PRODUIT ASTER** | **Non** présentée comme politique PKF du guide ; indépendante BEEYE/AGIRIS |

Code : `src/domain/rules/work-on-holiday.ts`, `src/application/services/work-on-holiday-service.ts`.

---

## 6. Procédure de mise à jour

1. Extraire la règle depuis le guide (noter la page).
2. Mettre à jour ce fichier avec la référence.
3. Ajuster `src/domain/rules/*` et les tests.
4. Retirer le marquage « HYPOTHÈSE DÉMO » uniquement lorsque la valeur est confirmée.

---

## 7. Arrêts de travail & congés spéciaux (Phase 13)

**Source :** Guide des pratiques RH — novembre 2026 (confidentiel, non versionné).

| Sujet | Statut | Notes |
|-------|--------|-------|
| Notification employeur 24 h | **Guide** | Rappel UI |
| Justificatif 48 h | **Guide** | Rappel UI ; déclaration possible sans document |
| Congés spéciaux (mariage/PACS, naissance, décès, déménagement, hosp. enfant, handicap/ALD, RDV TH, examen alternant) | **Guide p.46** | Catalogue ASTER ; plafonds numériques = hypothèse / revue RH si non confirmés |
| Paternité : préavis 1 mois | **Guide** | Rappel + flag revue RH |
| Cutoff justificatifs paie (j. 20) | **Guide** | Champ `payrollProcessingMonth` — pas de connecteur paie |
| Visite de reprise | **Guide p.62** | Maternité, AT/MP/trajet, ≥ 30 j ; organiser sous 8 j après retour |
| RTT non-cadres / titres-restaurant pendant arrêt | **Guide** | Info RH uniquement |
| Maintien CP maternité/paternité ; 1 an AT/MP | **Guide** | Info RH uniquement |

Code : `src/domain/rules/work-absence.ts`, `special-leave-entitlements.ts`, `work-absence-service.ts`. Doc produit : `docs/ABSENCES.md`.
