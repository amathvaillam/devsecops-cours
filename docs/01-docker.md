# Chapitre 01 — Docker

Objectif : comprendre image/conteneur, lire un Dockerfile, orchestrer avec
docker compose, et démarrer une base jetable pour les tests.

## 1. Les concepts (le minimum vital)

- **Image** = la recette : un paquet immuable contenant le code + ses dépendances.
  Elle n'est pas en train de tourner, elle existe simplement (comme une classe,
  ou une recette de cuisine).
- **Conteneur** = le plat : une instance *en cours d'exécution* d'une image
  (comme un objet, ou le gâteau sorti du four). On peut en lancer plusieurs
  depuis la même image.
- **Registre** = le livre de recettes partagé : DockerHub, où on publie et
  télécharge des images.

## 2. Notre Dockerfile, ligne par ligne

```dockerfile
FROM node:20-alpine        # l'image de base : Linux + Node 20 (version minimale "alpine")
WORKDIR /app               # le répertoire de travail dans le conteneur
COPY package*.json ./      # copie D'ABORD les manifests de dépendances
RUN npm ci --omit=dev      # installe les dépendances de production uniquement
COPY . .                   # puis copie le reste du code
EXPOSE 5000                # documente le port (informativement)
CMD ["node", "server.js"]  # la commande de démarrage du conteneur
```

**Pourquoi l'ordre compte** : Docker découpe le build en *couches* mises en
cache. Si `package.json` n'a pas changé, la couche `npm ci` est réutilisée telle
quelle → le build est quasi instantané. Si on copiait tout le code d'abord, la
moindre modification de code forcerait la réinstallation complète des
dépendances à chaque build.

## 3. docker-compose.yml, service par service

```yaml
services:
  db:                      # PostgreSQL 16
    volumes:
      - db_data:/var/lib/postgresql/data   # volume nommé : les données survivent aux redémarrages
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql  # exécuté au 1er démarrage seulement
  web:                     # notre API
    build: ./app           # construit l'image avec le Dockerfile
    environment: { DB_HOST: db }   # "db" = le NOM du service dans le réseau
    ports: ["5000:5000"]   # port hôte : port conteneur
    depends_on: [db]       # ordre de démarrage
```

Points clés :
- **Le réseau** : compose crée un réseau privé où chaque service est joignable
  par son **nom** (`db`, `web`). C'est pour ça que `DB_HOST=db` fonctionne sans
  adresse IP.
- **Le volume** : sans volume, les données de la base disparaîtraient à chaque
  destruction du conteneur.
- **`init.sql`** : le script n'est exécuté que si le volume est vide (premier
  démarrage). Pour le rejouer : supprimer le volume (`docker compose down -v`).

## 4. La base jetable des tests (ce qu'on a fait à la main)

```powershell
docker run -d --name tpcrud-test-db `     # -d : en arrière-plan
  -e POSTGRES_USER=tpuser `               # variables d'environnement du conteneur
  -e POSTGRES_PASSWORD=tppassword `
  -e POSTGRES_DB=tpdb `
  -p 5545:5432 `                          # publie le port 5432 du conteneur sur le 5545 de l'hôte
  -v "chemin\init.sql:/docker-entrypoint-initdb.d/init.sql:ro" `
  postgres:16-alpine

docker exec tpcrud-test-db pg_isready -U tpuser -d tpdb   # "es-tu prêt ?"
docker rm -f tpcrud-test-db                               # on jette le conteneur
```

Pourquoi jetable ? Chaque exécution de tests part d'un état identique et ne
pollue jamais la base de développement. C'est la **reproductibilité**.

## 5. La même chose dans la CI

Le bloc `services: postgres:` du workflow GitHub Actions (chapitre 04) fait
exactement ce `docker run` : image, variables, port, `init.sql`, et une
condition de santé (`pg_isready`). La CI, c'est cette manip **automatisée**.

## Vérification

- [x] `docker compose up -d --build` démarre les 3 services
- [x] `curl http://localhost:5000/health` répond `{"status":"ok"}`
- [x] La table `produits` est créée et peuplée par `init.sql`
- [x] `docker rm -f` nettoie la base jetable

## Réutilisable : quoi copier, quoi changer

| Élément | Réutilisable tel quel | À adapter par projet |
|---------|----------------------|----------------------|
| Dockerfile | le squelette (FROM, WORKDIR, COPY, RUN, CMD) | l'image de base (node/python/go), les commandes d'install |
| docker-compose | la structure services/réseaux/volumes | les images, ports, variables |
| La base jetable | la démarche (`docker run` + readiness + `rm -f`) | les identifiants, le script d'init |
