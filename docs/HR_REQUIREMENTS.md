# Exigences RH — PKF Arsilon (département Maroc)

**Périmètre ASTER :** Maroc uniquement. Le département France a son propre SIRH.

**Source MA :** Code du travail (loi 65-99), CNSS, calendrier officiel, politique interne Maroc — voir `docs/MOROCCO_HR_POLICY.md`.

Le guide RH France n’est **pas** une autorité pour les défauts Maroc. Les politiques FR Phase 2 sont désactivées (historique).  
Toute valeur chiffrée non confirmée est **À valider par RH**.

---

## 1. Classification d’emploi (Maroc)

| Sujet | Statut | Notes / source |
|-------|--------|----------------|
| Cadre / non-cadre | **Historique FR** | Conservé en enum ; **non déterminant** d’acquisition MA |
| `non_applicable` + `policyGroup` | **Implémenté** | Modèle Maroc |
| RTT statutaire | **Non** | Pas d’acquisition auto MA |
| Alternants | **À valider** | Congé annuel selon contrat — RTT non auto |

Code : `entitlement-policies.ts`, `MOROCCO_HR_POLICY.md`.

---

## 2. Congé annuel (Maroc)

| Sujet | Statut | Notes / source |
|-------|--------|----------------|
| Congé annuel payé | **À valider par RH** | Baseline proposée 1,5 j/mois (loi 65-99 citée) — **non auto-postée** |
| Politiques FR 2,08 / juin–mai | **Désactivées** | Historique ledger uniquement |
| Comptes ledger | **Conservés** | `conges_payes*` + `rtt` historique |
| Temps partiel | **À valider** | Pas de × % inventé |
| Report / expiry | **À valider** | Pas de règles FR appliquées |
| Demi-journées | **Implémenté (démo)** | Flags half-day |
| Circuit validation | **Produit** | Collaborateur → Chef ; RH lecture |
| Spéciaux | **À valider** | Catalogue événementiel, plafonds non statutaires MA |

Voir `docs/MOROCCO_HR_POLICY.md`.

---

## 3. Télétravail

**Politique produit** (présentation Conseil) — **pas** une obligation du Code du travail marocain. À confirmer par le département Maroc.

| Sujet | Statut | Notes / source |
|-------|--------|----------------|
| Plafond mensuel | **Paramétrable** | Défaut démo **12 j / mois** |
| Max hebdo UI | **Paramétrable** | Défaut **2 j / semaine** |
| 80 % présence | **Non imposé comme loi MA** | Ancienne mention guide FR — non défaut Maroc |
| Compatibilité des tâches | **Implémenté (flag)** | `Employee.teleworkEligible` |
| Circuit validation | **Implémenté** | Collaborateur → Chef ; RH sans décision |

Code : `telework-monthly.ts`, `telework-service.ts`.

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
