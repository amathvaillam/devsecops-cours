pipeline {
    agent any

    environment {
        // L'image publiée sur DockerHub : pseudo DockerHub / nom du projet
        DOCKER_IMAGE = 'availlam/tp-crud'
    }

    stages {
        stage('Build') {
            steps {
                sh 'docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} ./app'
            }
        }

        stage('Test') {
            steps {
                // 1. Une base PostgreSQL jetable, sur un réseau dédié
                sh 'docker rm -f tp-test-db || true'
                sh 'docker network create tp-ci-net || true'
                sh 'docker run -d --name tp-test-db --network tp-ci-net -e POSTGRES_USER=tpuser -e POSTGRES_PASSWORD=tppassword -e POSTGRES_DB=tpdb postgres:16-alpine'

                // 2. Attendre que la base soit prête (max 30 s)
                //    ⚠️ piège vécu : au premier démarrage, l'entrypoint Postgres lance un
                //    serveur TEMPORAIRE (socket seul) pour l'init, puis l'arrête et démarre
                //    le vrai. Un check sur le socket peut répondre "accepting" puis
                //    disparaître. En TCP (-h 127.0.0.1), seul le VRAI serveur répond.
                sh '''
                    for i in $(seq 1 30); do
                        docker exec tp-test-db pg_isready -h 127.0.0.1 -U tpuser -d tpdb && break
                        sleep 1
                    done
                '''

                // 3. Créer la table via init.sql (copié dans le conteneur)
                sh 'docker cp db/init.sql tp-test-db:/tmp/init.sql'
                sh 'docker exec tp-test-db psql -U tpuser -d tpdb -f /tmp/init.sql'

                // 4. La vraie suite de tests, contre cette base
               sh 'docker run --rm --user root --network tp-ci-net -e DB_HOST=tp-test-db -e DB_PORT=5432 -e DB_NAME=tpdb -e DB_USER=tpuser -e DB_PASSWORD=tppassword ${DOCKER_IMAGE}:${BUILD_NUMBER} sh -c "npm ci && npm test"'
            }
        }
        stage('Scan image (trivy)') {
            steps {
                // Exception DOCUMENTEE : l'outillage npm bundle dans l'image de base
                // (non utilise au runtime — on lance node server.js) porte des CVE HIGH.
                // L'OS et les dependances applicatives restent scannes strictement.
                sh 'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 1 --no-progress --skip-dirs usr/local/lib/node_modules/npm ${DOCKER_IMAGE}:${BUILD_NUMBER}'
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

    post {
        always {
            // Nettoyage, que le pipeline ait réussi ou échoué
            sh 'docker rm -f tp-test-db || true'
            sh 'docker network rm tp-ci-net || true'
        }
    }
}
