# Chapitre 07 — Déploiement réel

> ⏳ Chapitre à venir — étape 6.

Objectif : déployer l'API sur un vrai serveur, avec healthcheck, logs, et la
possibilité de revenir en arrière (rollback).

## Ce qu'on y apprendra

- HEALTHCHECK Docker (réutilise notre endpoint `/health`)
- Centraliser les logs (`docker logs`, puis un outil dédié)
- Déployer une version précise de l'image (tag), pas « latest »
- Rollback : repartir sur le tag précédent en une commande

## Vérification (à venir)

- [ ] L'API est accessible sur le serveur et `/health` répond
- [ ] Les logs sont consultables
- [ ] Un rollback simulé fonctionne

## Réutilisable : quoi copier, quoi changer

- Le bloc HEALTHCHECK du Dockerfile : générique
- La procédure de rollback : identique partout (c'est la valeur des tags)
