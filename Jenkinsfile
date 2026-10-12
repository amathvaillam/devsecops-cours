pipeline {
    agent any

    environment {
        // Remplacez par votre identifiant DockerHub (ex: monuser/tp-crud)
        DOCKER_IMAGE = 'DOCKERHUB_USERNAME/tp-crud'
    }

    stages {
        stage('Build') {
            steps {
                sh 'docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} ./app'
            }
        }

        stage('Test') {
            steps {
                // Vérifie la syntaxe du code et le démarrage de l'API
                sh 'docker run --rm -e DB_HOST=unused -e DB_NAME=unused -e DB_USER=unused -e DB_PASSWORD=unused ${DOCKER_IMAGE}:${BUILD_NUMBER} node --check server.js'
            }
        }

        stage('Push DockerHub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                    sh 'docker tag ${DOCKER_IMAGE}:${BUILD_NUMBER} ${DOCKER_IMAGE}:latest'
                    sh 'docker push ${DOCKER_IMAGE}:${BUILD_NUMBER}'
                    sh 'docker push ${DOCKER_IMAGE}:latest'
                }
            }
        }
    }
}
