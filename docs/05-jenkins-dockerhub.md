# Chapitre 05 — Jenkins & DockerHub

> ⏳ Chapitre à venir — on le remplira ensemble au moment de l'étape 4.

Objectif : construire une chaîne de **CD** (continuous delivery) auto-hébergée :
Build → Test → Push vers DockerHub, avec tags versionnés et credentials.

## Ce qu'on y apprendra

- Installer Jenkins en local (conteneur Docker) et le configurer
- Lire le `Jenkinsfile` : stages, environment, credentials
- Publier l'image sur DockerHub avec un tag versionné (`${BUILD_NUMBER}`)
- La différence CI (feedback rapide, cloud) vs CD (release, auto-hébergé)

## Notre Jenkinsfile actuel

```groovy
pipeline {
    agent any
    stages {
        stage('Build') { ... docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} ... }
        stage('Test')  { ... }
        stage('Push DockerHub') { ... docker login + docker push ... }
    }
}
```

## Vérification (à venir)

- [ ] Jenkins est accessible et connecté au dépôt GitHub
- [ ] La pipeline Build → Test → Push tourne et devient verte
- [ ] L'image apparaît sur DockerHub avec les bons tags

## Réutilisable : quoi copier, quoi changer

- Le `Jenkinsfile` : squelette générique (remplacer l'image, les commandes de
  test, l'identifiant DockerHub et le nom du credential)
