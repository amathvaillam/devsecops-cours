# Chapitre 08 — Multirepo

> ⏳ Chapitre à venir — étape 7.

Objectif : découper le monorepo en plusieurs dépôts spécialisés.

## La découpe classique

- **repo app** : le code applicatif (ce repo, moins l'infra)
- **repo infra** : docker-compose de prod, scripts de déploiement
- **repo CI/CD** : workflows et pipelines partagés (reusable workflows,
  Jenkinsfiles partagés)

## Pourquoi couper ?

- Chaque dépôt a son propre cycle de vie et ses propres droits d'accès
- Les équipes infra et dev avancent sans se marcher dessus
- Les pipelines deviennent des briques réutilisables entre projets

## Vérification (à venir)

- [ ] Les 3 dépôts existent et communiquent
- [ ] Une modification de l'app ne touche pas l'infra (et inversement)

## Réutilisable

- La découpe app / infra / ci : transposable à tout projet qui grandit
