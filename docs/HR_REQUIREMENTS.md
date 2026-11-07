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
| Circuit validation | **HYPOTHÈSE DÉMO** | Collaborateur → Manager (RH optionnel) |
| Types d’absence | **Démo** | CP, RTT, sans solde, maladie, exceptionnel, parental |

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
| Continuité de service | **Documenté** | Condition p.106 ; refus manager possible avec motif |
| Planification hebdomadaire UI | **Implémenté** | **Maximum 2 jours / semaine** dans le plan mensuel |
| Pas de week-end | **Implémenté** | Validation domaine |
| Conflits congés approuvés | **Implémenté** | Intersection dates refusée |
| Circuit validation | **Implémenté** | Collaborateur → Manager (motif obligatoire en cas de refus) |

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
| Manager | Validation équipe directe |
| Administrateur RH | Vue transverse + validations de démo |

Le mapping vers les groupes Microsoft Entra ID reste à définir (`docs/INTEGRATIONS.md`).

---

## 5. Documents & confidentialité

- Aucun document RH confidentiel réel dans le dépôt.
- Les PDF listés dans l’UI sont des **métadonnées mock**.
- Ne jamais committer le guide RH source.

---

## 6. Procédure de mise à jour

1. Extraire la règle depuis le guide (noter la page).
2. Mettre à jour ce fichier avec la référence.
3. Ajuster `src/domain/rules/*` et les tests.
4. Retirer le marquage « HYPOTHÈSE DÉMO » uniquement lorsque la valeur est confirmée.
