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
  - ⚠️ Pièges vécus (3 !) : `docker cp` obligatoire au lieu de `-v` (le daemon
    voit le disque de la machine, **pas** celui du conteneur Jenkins) ; `npm ci`
    indispensable car l'image de prod est construite `--omit=dev` ; et la
    **course du serveur temporaire** : au premier démarrage, l'entrypoint
    Postgres lance un serveur TEMPORAIRE (socket seul), le coupe, puis démarre
    le vrai — un `pg_isready` sur le socket peut croire le temporaire prêt
    (échec intermittent du build #7). La vérification en **TCP** (`-h 127.0.0.1`)
    n'accepte que le vrai serveur. « Des fois ça marche » = race condition.
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

## 5. Le déclenchement automatique (webhook + ngrok, domaine statique)

Problème : Jenkins vit sur `localhost` — GitHub ne peut pas l'atteindre.

**Solution retenue : ngrok avec domaine statique gratuit — l'URL ne change JAMAIS.**

- Authtoken rangé dans `C:\Users\availlam\ngrok\ngrok.env` (hors dépôt, hors
  ligne de commande) → passé au conteneur via `--env-file`
- ngrok **en Docker** : le binaire Windows est mis en quarantaine par l'EDR de
  la machine (vécu — voir incidents) ; dans la VM Linux de Docker il vit
  tranquille, et c'est cohérent avec le reste de la stack
- Lancement :
  `docker run -d --name ngrok -p 4040:4040 --env-file "C:\Users\availlam\ngrok\ngrok.env" ngrok/ngrok:latest http host.docker.internal:8090 --url=steadfast-fifth-causing.ngrok-free.dev`
- Webhook GitHub : `https://steadfast-fifth-causing.ngrok-free.dev/github-webhook/`
  (événement `push`)
- Case dans le job Jenkins : « GitHub hook trigger for GITScm polling »
  (sans elle, le job n'écoute pas — vérifié : `<triggers/>` vide)
- Résultat vérifié : push → build automatique (`GitHubPushCause`) → DockerHub.

### Les incidents vécus (et les réflexes appris)

1. **Le tunnel éphémère** : premier essai avec le quick tunnel cloudflared
   (`trycloudflare.com`) — mort après ~17 h puis ~30 h → livraisons webhook en
   **502**. Diagnostic : page du webhook → *Recent Deliveries* → statut HTTP.
   Leçon : une chaîne casse à son maillon le plus faible ; on inspecte chaque
   maillon (delivery → tunnel → Jenkins).
2. **L'EDR corporate** : `ngrok.exe` supprimé silencieusement du disque
   (quarantaine — Defender désactivé, donc agent tiers). Leçon : en
   environnement géré, certains binaires ne passent pas ; Docker est un
   contournement propre et reproductible.
3. **La redelivery** : GitHub conserve chaque livraison et permet de **rejouer**
   un événement raté (Recent Deliveries → Redeliver, ou API
   `POST /hooks/{id}/deliveries/{id}/attempts`). C'est ainsi que le build #7
   (perdu dans le 502) a été ressuscité. Vérifié : livraison rejouée → 200.

## Vérification

- [x] Jenkins répond sur `localhost:8090`, CLI Docker connecté (client 29.9.0 → serveur 29.5.2)
- [x] Credential `dockerhub-credentials` créé (token, pas mot de passe)
- [x] Pipeline configurée en « Pipeline script from SCM » sur le dépôt
- [x] Stage Test = vraie suite de tests avec base jetable
- [x] Builds 1 à 8 : le #7 (rouge) = course du serveur temporaire Postgres,
  corrigée par le readiness TCP — validée par le build #8 vert
- [x] Images sur DockerHub : tags `3` à `8` + `latest`
- [x] Déclenchement automatique par webhook (build #5) ; build #7 ressuscité
  par **redelivery** ; URL stable **ngrok** (domaine statique)

## Réutilisable : quoi copier, quoi changer

- `jenkins/Dockerfile` + commande de lancement : tels quels (adapter le port)
- `Jenkinsfile` : squelette Build → Test → Push générique
  - à adapter : `DOCKER_IMAGE`, commandes de test, SGBD de la base jetable
  - le pattern `withCredentials` + ID : universel
- La base jetable dans un stage Jenkins : transposable à tout projet
