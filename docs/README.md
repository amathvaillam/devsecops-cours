# 📚 Parcours DevOps / DevSecOps — sommaire

Chaque fichier de ce dossier = **un chapitre du parcours**. Un chapitre contient :
les concepts expliqués, les commandes à exécuter, la vérification, et la partie
« réutilisable » (quoi copier dans un vrai projet, quoi adapter).

**Comment on travaille** : je te donne les instructions, tu exécutes les commandes,
on vérifie ensemble que ça marche, puis on coche les cases. Un chapitre n'est
terminé que lorsque la vérification est passée.

## Chapitres

- [x] [01 — Docker](01-docker.md) — images, conteneurs, Dockerfile, compose, base jetable
- [x] [02 — Git & GitHub](02-git-github.md) — commits conventionnels, branches, pull requests
- [x] [03 — Les tests](03-tests.md) — node:test, supertest, unitaire vs intégration
- [x] [04 — CI avec GitHub Actions](04-ci.md) — workflow, services, boucle de feedback
- [x] [05 — Jenkins & DockerHub](05-jenkins-dockerhub.md) — pipeline CD, credentials, tags d'image
- [ ] [06 — DevSecOps](06-devsecops.md) — secrets, SAST, CVE, scan d'image
- [ ] [07 — Déploiement réel](07-deploiement.md) — healthcheck, environnements, rollback
- [ ] [08 — Multirepo](08-multirepo.md) — séparer app / infra / CI

## Règles du parcours

1. Un chapitre = un concept + un changement concret dans ce projet
2. On exécute, on **vérifie**, et seulement ensuite on coche
3. Chaque chapitre se termine par « Réutilisable » : le template transférable

## Décisions d'architecture

- [Rôles des pipelines — GitHub Actions (CI) & Jenkins (CD)](pipeline-roles.md)
  — boussole des chapitres 06+ : quoi confier à qui, et pourquoi

## Travaux pratiques

- [TP 01 — Les remotes de A à Z (avec livraison finale)](tp-01-remotes.md) —
  fetch/pull, tracking, prune, rouge→vert, puis livraison d'un endpoint complet
