# Localisation — ASTER Maroc

| Paramètre | Valeur |
|-----------|--------|
| Pays | Maroc |
| Département employeur | PKF Arsilon — Maroc |
| Timezone par défaut | `Africa/Casablanca` |
| Locale UI / format | `fr-MA` (interface en français) |
| Devise | MAD (dirham marocain) |
| Calendrier férié | Maroc (`morocco-holidays.ts`) |
| Week-end défaut produit | samedi–dimanche (configurable ; **à confirmer** par site) |

## Terminologie

| Ancien (FR cabinet) | ASTER Maroc |
|---------------------|-------------|
| Cadre / non-cadre (déterminant RTT) | Non utilisé pour les droits ; `category=non_applicable` en démo MA |
| CP guide France 2,08 / juin–mai | Congé annuel MA — politique séparée, non auto |
| RTT statutaire | Non créé automatiquement |
| Guide RH France p.38–48 | Historique FR désactivé |

## Organisation démo

Départements candidats (présentation Conseil) : Direction, Ressources Humaines, Audit & Assurance, Conseil, Expertise comptable, Systèmes d’information.  
Sites démo : Casablanca, Rabat — **fictifs**, non des adresses réelles.

## Code

- `src/domain/config/aster-locale.ts`
- Reporting : `MOROCCO_TZ` déjà en place
