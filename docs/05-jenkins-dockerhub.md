# Chapitre 05 — Jenkins & DockerHub ✅

Objectif : une chaîne de **CD auto-hébergée** — Jenkins dans Docker, pipeline
Build → Test → Push, déclenchée **automatiquement** par chaque push GitHub.

## 1. Les concepts

- **Jenkins** = serveur d'automatisation auto-hébergé. La logique est celle de
  la CI (déclencheurs, stages, feedback — chapitre 04), mais la machine est à
  toi : tu la configures, tu la maintiens.
- **Pipeline as code** : le `Jenkinsfile` vit **dans le dépôt**, versionné avec
  le code — il évolue par branches et pull requests comme le reste.
- **Immutabilité des artefacts** : une image taguée `:5` ne changera jamais.
  `latest` bouge — en prod on déploie des tags précis, jamais `latest`.
- **Docker-outside-of-Docker** : Jenkins tourne dans un conteneur mais pilote
  le Docker de la machine via le socket monté.

## 2. L'installation (dans ce repo)

- `jenkins/Dockerfile` : image Jenkins LTS + CLI Docker
- Lancement : port **8090** (8080 était pris), volume `jenkins_home` (la
  config survit), et surtout le **socket** :
  `-v /var/run/docker.sock:/var/run/docker.sock` → Jenkins peut lancer
  `docker build/run/push` sur la machine hôte
- Déblocage : mot de passe initial lu avec
  `docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`

## 3. Le Jenkinsfile expliqué

- **Build** : `docker build -t availlam/tp-crud:${BUILD_NUMBER} ./app`
  (`BUILD_NUMBER` = variable fournie par Jenkins : 3, 4, 5…)
- **Test** : notre rituel local complet, porté dans Jenkins :
  base jetable (réseau dédié + `postgres:16-alpine`), boucle
  `pg_isready` (max 30 s), `docker cp` de `init.sql`, puis la vraie suite
  `npm ci && npm test` **dans l'image construite**.
  - ⚠️ Pièges vécus : `docker cp` obligatoire au lieu de `-v` (le daemon voit
    le disque de la machine, **pas** celui du conteneur Jenkins) ; `npm ci`
    indispensable car l'image de prod est construite `--omit=dev`.
- **Push DockerHub** : `withCredentials` → `docker login --password-stdin`,
  tag `${BUILD_NUMBER}` **et** `latest`, deux pushs.
- **post { always }** : nettoyage des conteneurs/réseau de test, succès ou
  échec — on ne laisse jamais de cadavres traîner.

## 4. Les credentials (le secret, bien rangé)

- Sur DockerHub : **Access Token** (Read & Write) — jamais le mot de passe.
- Dans Jenkins : Credentials → System → Global → **Username with password**,
  ID = `dockerhub-credentials`, password = le token.
- Le Jenkinsfile ne contient que l'**ID** :
  `credentialsId: 'dockerhub-credentials'` → Jenkins injecte `DOCKER_USER` /
  `DOCKER_PASS` au moment du run. Chacun configure ses valeurs sous le même
  ID → le pipeline reste générique et le dépôt public reste vierge de secrets.

## 5. Le déclenchement automatique (webhook + tunnel)

Problème : Jenkins vit sur `localhost` — GitHub ne peut pas l'atteindre.

- **Tunnel** : `docker run -d --name cloudflared cloudflare/cloudflared tunnel --url http://host.docker.internal:8090`
  → URL publique éphémère (`https://…trycloudflare.com`, via l'API GitHub :
  hook créé le 13/10 à 22:55 UTC).
- **Webhook GitHub** : Settings → Webhooks → URL `…/github-webhook/`,
  événement `push`.
- **Case dans le job Jenkins** : « GitHub hook trigger for GITScm polling »
  (sans elle, le job n'écoute pas — vérifié : `<triggers/>` vide).
- **Résultat vérifié** : un push → build **#5** lancé tout seul
  (cause `GitHubPushCause`) → image `:5` sur DockerHub. Chaîne complète :
  `push → GitHub → webhook → tunnel → Jenkins → Build → Test → Push`.

> ⚠️ Limitation connue : l'URL `trycloudflare` est **éphémère** (elle meurt au
> redémarrage de cloudflared). Il faut alors recréer tunnel + webhook. La vraie
> solution (domaine stable) viendra avec le chapitre 07 — déploiement.

## Vérification

- [x] Jenkins répond sur `localhost:8090`, CLI Docker connecté (client 29.9.0 → serveur 29.5.2)
- [x] Credential `dockerhub-credentials` créé (token, pas mot de passe)
- [x] Pipeline configurée en « Pipeline script from SCM » sur le dépôt
- [x] Stage Test = vraie suite de tests avec base jetable
- [x] Build #4 SUCCESS sur main ; builds 1-5 dans l'historique
- [x] Images sur DockerHub : tags `3`, `4`, `5` + `latest`
- [x] Push déclenché automatiquement → build #5 (`GitHubPushCause`)

## Réutilisable : quoi copier, quoi changer

- `jenkins/Dockerfile` + commande de lancement : tels quels (adapter le port)
- `Jenkinsfile` : squelette Build → Test → Push générique
  - à adapter : `DOCKER_IMAGE`, commandes de test, SGBD de la base jetable
  - le pattern `withCredentials` + ID : universel
- La base jetable dans un stage Jenkins : transposable à tout projet
