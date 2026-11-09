# Arrêts de travail & absences spéciales

Routes :

- Collaborateur : `/absences`
- RH / Chef : `/administration/absences`

Module **distinct** des demandes CP/RTT (`LeaveRequest`).

## Sources

| Élément | Statut |
|---------|--------|
| Délais 24 h notification / 48 h justificatif | **Guide RH** (rappels UI, pas de décision légale auto) |
| Cutoff paie le 20 du mois | **Guide RH** (indicateur `payrollProcessingMonth`, pas de paie ASTER) |
| Congés spéciaux catégories p.46 | **Guide** — plafonds chiffrés non confirmés = revue RH (`hypothese_demo` / `maxDays: null`) |
| Visite de reprise p.62 | **Guide** — maternité, AT/MP/trajet, absence ≥ 30 j ; délai 8 j après retour |
| Suspension RTT non-cadres / titres-restaurant | **Guide** — informations RH affichées, **sans** ajustement automatique de soldes |
| Maintien CP maternité/paternité et 1 an AT/MP | **Guide** — information RH |
| Namespace storage `employee-absence-documents/…` | **Décision produit ASTER** |
| Statuts workflow Déclaré → … → Terminé/Refusé | **Décision produit ASTER** |

## Rôles

- **Collaborateur** : déclarer / suivre / uploader ses justificatifs.
- **RH** : traiter, notes internes, documents médicaux, lier prolongation/rechute, visite reprise.
- **Chef de projet** : vue opérationnelle globale **sans** accès aux certificats médicaux ni traitement RH.

## Confidentialité

Pas d’exposition des certificats dans l’annuaire, les exports reporting ordinaires, ni le calendrier partagé (pairs = « Absence »).
