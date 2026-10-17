# Rôles des pipelines — GitHub Actions (CI) & Jenkins (CD)

**Décision d'architecture du parcours** : les deux systèmes coexistent, avec
des rôles **distincts et complémentaires**. Ce document est la boussole des
chapitres 06+ : chaque nouvelle brique (scan, déploiement…) doit venir se
poser à l'endroit prévu ici.

## Le critère qui décide de tout

Un job de pipeline a deux besoins qui déterminent son lieu de vie :

1. **Accès réseau** — doit-il toucher des machines privées (serveurs de prod,
   registry interne, base intranet) ? Un runner cloud GitHub ne peut pas
   atteindre un réseau privé. Un Jenkins auto-hébergé, si.
2. **Secrets** — doit-il manipuler des credentials sensibles (déploiement,
   authentification prod) ? On préfère les garder dans **son** réseau.

> **La règle** : plus un job est proche de la production, plus il doit vivre
> près de la production.

## La répartition

### GitHub Actions = la porte d'entrée (CI)

- Tourne en priorité sur les **pull requests** : lint, tests, build → le check
  vert qui garde le merge (revue de code).
- Feedback rapide, hébergé, zéro maintenance.
- **Aucun secret, aucun déploiement** : il vérifie, il ne touche à rien.

### Jenkins = la salle des machines (CD)

- Tourne sur **main** (après merge) : construction de l'artefact de release,
  scan final, **push DockerHub**, puis **déploiement** et rollback (chap. 07).
- Garde les **secrets** (token DockerHub…) et l'accès à l'infra.
- Porte les **jobs planifiés et longs** : scans nocturnes, rapports.

## Le flux cible

```
PR          → GitHub Actions : lint + tests + build        (gate de merge)
merge main  → Jenkins        : build tagué + scans + push   (release)
              (GH Actions    : re-run des tests, filet de sécurité)
```

## La redondance actuelle (état du parcours)

Aujourd'hui, chaque push sur main déclenche **les deux** (tests + build des
deux côtés). Acceptable pour apprendre — on resserrera à mesure que les
chapitres ajoutent leurs briques :

- Chapitre 06 : les scans de code rejoignent **GH Actions/PR** ; le scan
  d'image, le DAST et le scan nocturne rejoignent **Jenkins**.
- Chapitre 07 : le déploiement vit dans **Jenkins** (jamais dans le cloud).

## Placement prévu des briques de sécurité (chap. 06)

- **gitleaks** (secrets commités) → GH Actions, sur PR → shift-left maximal
- **semgrep** (SAST, analyse du code) → GH Actions, sur PR
- **npm audit** (CVE des dépendances) → GH Actions, sur PR
- **trivy image** (CVE de l'image construite) → Jenkins, **avant le push**
  (on scanne l'artefact exact qu'on publie)
- **zap baseline** (DAST, scan de l'app déployée) → Jenkins, **après le
  déploiement** (il faut une cible vivante, inaccessible depuis le cloud)
- **scan complet nocturne** (cron) → Jenkins (job planifié — le cloud n'a pas
  à porter ça)

## Et si un seul outil doit rester ?

- **Projet perso / open source, pas d'infra privée** → GitHub Actions seul
  suffit (un runner self-hosted existe si un jour il faut le réseau privé —
  mais c'est « un mini-Jenkins » à maintenir).
- **Accès réseau privé, contraintes d'entreprise, jobs planifiés** → Jenkins
  justifie sa maintenance.
- **Les deux** → la répartition de ce document. C'est le plus courant dès
  qu'une équipe grandit.

## Le résumé en 4 questions

1. Le job touche-t-il au **réseau privé / à la prod** ? → Jenkins
2. Manipule-t-il des **secrets de production** ? → Jenkins
3. Doit-il donner un **feedback rapide sur PR** ? → GH Actions
4. Doit-il tourner **planifié / longtemps** ? → Jenkins

Les quatre réponses « oui » avec les mêmes cases cochées de ce document = un
pipeline sain.
