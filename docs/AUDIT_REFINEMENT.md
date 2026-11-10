# ASTER — Audit de raffinement (2026-11-10)

Audit evidence-based avant corrections. Production : `https://aster-rh.vercel.app` (non re-vérifiée dans ce cycle sauf build local).

## Synthèse

ASTER est un prototype RH cohérent (3 rôles, ports/adaptateurs, modules métier majeurs livrés). Les risques les plus sérieux sont **session JWT figée après démotion de rôle**, quelques fuites d’information RH vers intervieweurs, et des **éléments UX trompeurs** (notifications jamais lues, double système documents, libellés).

## P0 — Critique (sécurité / intégrité / tromperie démo)

| ID | Problème | Impact | Preuve | Solution |
|----|----------|--------|--------|----------|
| P0-1 | Notifications seed `read:false` sans mark-as-read | Badge permanent Chef/RH en démo | `demo-seed.ts`, pas d’action markRead | Mark-as-read sur ouverture /notifications |
| P0-2 | Profil « documents » ≠ demandes `/documents` | Utilisateur croit télécharger des bulletins | `profil/page.tsx`, dashboard quick actions | Clarifier copy ; distinguer exemples démo |
| P0-3 | Nav « Recrutement / entretiens » | Confusion avec entretiens de performance | `navigation.ts`, RECRUITMENT.md | Renommer « Recrutement » |

## P1 — Important

| ID | Problème | Impact | Preuve | Solution |
|----|----------|--------|--------|----------|
| P1-1 | Rôle JWT non rafraîchi depuis `UserAccount` | Élévation jusqu’à 8h après démotion | `session-auth.ts`, `auth.config.ts` | Recharger role + isActive compte à chaque `getSession` |
| P1-2 | `callbackUrl` accepte `//evil.com` | Open redirect post-login | `actions/auth.ts` | Valider chemin relatif strict |
| P1-3 | Patch HR `isActive` sans sync compte | Contournement cycle de vie | `employee-service.ts`, form RH | Retirer `isActive` du patch HR |
| P1-4 | `hrNotes` visibles intervieweur | Fuite notes internes | `entretiens/[id]/page.tsx` | Redacter sauf RH/Chef recrutement |
| P1-5 | Congés vs Absences libellés | Confusion modules | nav + pages | Renommer Congés (CP/RTT) |
| P1-6 | `findNavItem` premier match | Titre topbar faux sur sous-routes admin | `navigation.ts` | Longest href match |

## P2 — UX / maintenabilité

| ID | Problème | Solution |
|----|----------|----------|
| P2-1 | Tagline EN « Human Resources, connected. » | FR |
| P2-2 | Pas de `loading.tsx` / `error.tsx` app | Ajouter FR |
| P2-3 | Paramètres expose docs techniques à tous | Restreindre / adoucir copy |
| P2-4 | Mobile « Plus… » → paramètres | Améliorer libellé |
| P2-5 | `getSession` ignore `UserAccount.isActive` | Couvert par P1-1 |
| P2-6 | Mock storage override Production | Documenter / durcir si safe |

## P3 — Optionnel

- Rate limit login process-local
- Mot de passe temporaire renvoyé au navigateur (démo)
- ROADMAP « switch de rôles » obsolète

## Hors scope immédiat (documenté)

- SSO Entra productif
- Modules planned (temps, frais, rémunération, formation, mobilité)
- Connecteur paie réel
- Plafonds congés spéciaux guide p.46 non confirmés
