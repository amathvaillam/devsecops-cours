// =============================================================================
//  PIPELINE CD — tp-crud
//
//  Declencheur : push sur main (webhook GitHub -> ngrok -> Jenkins).
//  Defilement : 1.BUILD -> 2.TEST -> 3.SCAN -> 4.PUSH -> 5.DEPLOY -> 6.DAST
//
//  REGLE D OR : l image construite a l etape 1 est CELLE testee, scannee,
//  publiee, deployee et sondee aux etapes suivantes. Un seul artefact.
// =============================================================================
pipeline {
    agent any

    environment {
        // Image publiee sur DockerHub : <pseudo>/<projet>
        DOCKER_IMAGE = 'availlam/tp-crud'
    }

    stages {

        // =====================================================================
        //  ETAPE 1/6 — BUILD
        //  Construit l image du commit courant, taguee avec le numero de build.
        //  Un tag = un artefact immuable (jamais "latest" seul).
        // =====================================================================
        stage('1. Build') {
            steps {
                echo '################ ETAPE 1/6 : BUILD ################'
                sh 'docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} ./app'
            }
        }

        // =====================================================================
        //  ETAPE 2/6 — TEST
        //  Base PostgreSQL jetable + la vraie suite de tests (npm test)
        //  executee DANS l image construite a l etape 1 (test what you ship).
        //  --user root : l image de prod est non-root, mais le conteneur de
        //  test doit pouvoir ecrire node_modules (npm ci). Test != artefact.
        // =====================================================================
        stage('2. Test') {
            steps {
                echo '################ ETAPE 2/6 : TESTS ################'
                sh 'docker rm -f tp-test-db || true'
                sh 'docker network create tp-ci-net || true'
                sh 'docker run -d --name tp-test-db --network tp-ci-net -e POSTGRES_USER=tpuser -e POSTGRES_PASSWORD=tppassword -e POSTGRES_DB=tpdb postgres:16-alpine'

                // Attente en TCP : le serveur temporaire d initdb n ecoute pas en TCP
                sh '''
                    for i in $(seq 1 30); do
                        docker exec tp-test-db pg_isready -h 127.0.0.1 -U tpuser -d tpdb && break
                        sleep 1
                    done
                '''

                sh 'docker cp db/init.sql tp-test-db:/tmp/init.sql'
                sh 'docker exec tp-test-db psql -U tpuser -d tpdb -f /tmp/init.sql'

                sh 'docker run --rm --user root --network tp-ci-net -e DB_HOST=tp-test-db -e DB_PORT=5432 -e DB_NAME=tpdb -e DB_USER=tpuser -e DB_PASSWORD=tppassword ${DOCKER_IMAGE}:${BUILD_NUMBER} sh -c "npm ci && npm test"'
            }
        }

        // =====================================================================
        //  ETAPE 3/6 — SCAN IMAGE (trivy)
        //  Gate de securite de l ARTEFACT : CVE OS + dependances de l image.
        //  --exit-code 1 => un finding HIGH/CRITICAL bloque la publication.
        //  --skip-dirs npm : outillage npm non utilise au runtime (justifie).
        // =====================================================================
        stage('3. Scan image (trivy)') {
            steps {
                echo '################ ETAPE 3/6 : SCAN TRIVY ################'
                sh 'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 1 --no-progress --skip-dirs usr/local/lib/node_modules/npm ${DOCKER_IMAGE}:${BUILD_NUMBER}'
            }
        }

        // =====================================================================
        //  ETAPE 4/6 — PUSH DOCKERHUB
        //  Publie l artefact valide : tag du build (immuable) + latest (mobile).
        //  Credentials Jenkins : le token n est JAMAIS en clair dans le depot.
        // =====================================================================
        stage('4. Push DockerHub') {
            steps {
                echo '################ ETAPE 4/6 : PUSH DOCKERHUB ################'
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

        // =====================================================================
        //  ETAPE 5/6 — DEPLOY (approbation)
        //  Continuous Delivery : le pipeline S ARRETE et attend le clic humain.
        //  Le compose de prod TIRE l image versionnee (aucun build sur serveur).
        //  Puis : schema (idempotent) + smoke test post-deploiement.
        // =====================================================================
        stage('5. Deploy (approbation)') {
            steps {
                echo '################ ETAPE 5/6 : DEPLOY ################'
                input message: "Deployer availlam/tp-crud:${BUILD_NUMBER} en production ?", ok: 'Deployer'

                withEnv(["TAG=${BUILD_NUMBER}"]) {
                    sh 'docker compose -p tpcrudprod -f compose.prod.yml pull'
                    sh 'docker compose -p tpcrudprod -f compose.prod.yml up -d --remove-orphans'
                }

                // Attente DB avant le schema (initdb du premier demarrage)
                sh '''
                    for i in $(seq 1 30); do
                        docker exec tpcrudprod-db-1 pg_isready -h 127.0.0.1 -U tpuser -d tpdb && break
                        sleep 1
                    done
                '''

                // Schema au premier deploiement uniquement (idempotent)
                sh 'docker exec tpcrudprod-db-1 psql -U tpuser -d tpdb -tAc "SELECT count(*) FROM produits" || docker exec -i tpcrudprod-db-1 psql -U tpuser -d tpdb < db/init.sql'

                // Smoke test POST-deploiement
                sh 'docker exec tpcrudprod-web-1 wget -qO- http://127.0.0.1:5000/health | grep -q ok'
            }
        }

        // =====================================================================
        //  ETAPE 6/6 — DAST (OWASP ZAP, baseline)
        //  Scan DYNAMIQUE de l environnement deploye : on sonde l app qui
        //  tourne (headers manquants, config, surface exposee...).
        //  C est le pendant "vivant" du SAST (semgrep, qui lit le code).
        //  MODE RAPPORT pour l instant (|| true) : on observe avant de bloquer.
        //  Prochaine etape : en faire un gate, comme trivy (calibration).
        // =====================================================================
        stage('6. DAST (ZAP baseline)') {
            steps {
                echo '################ ETAPE 6/6 : DAST ZAP ################'
                sh 'docker rm -f zap-scan || true'

                // -I : ne pas echouer sur les WARN ; cible = l API deployee
                sh 'docker run --name zap-scan -t ghcr.io/zaproxy/zap-stable zap-baseline.py -t http://host.docker.internal:5002/produits -r zap-baseline-report.html -I || true'

                // Recupere le rapport dans le workspace (docker cp : cf. TP 02)
                sh 'docker cp zap-scan:/zap/wrk/zap-baseline-report.html . || true'
                sh 'docker rm -f zap-scan || true'
            }
            post {
                always {
                    // Rapport telechargeable depuis la page du build
                    archiveArtifacts artifacts: 'zap-baseline-report.html', allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            echo '################ NETTOYAGE ################'
            sh 'docker rm -f tp-test-db || true'
            sh 'docker network rm tp-ci-net || true'
        }
    }
}
