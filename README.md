# tp-crud — API CRUD (TP DevOps / DevSecOps)

API REST de gestion de produits, construite en Node.js (Express 5) + PostgreSQL.
Ce dépôt sert de **terrain d'apprentissage progressif** : chaque étape ajoute une
brique DevOps/DevSecOps au même pipeline, jusqu'à obtenir un pipeline complet
réutilisable dans de vrais projets.

## Architecture

```
docker compose up
├── web      → Express 5 + pg (port 5000)
├── db       → PostgreSQL 16 (init auto via db/init.sql)
└── pgadmin  → interface d'administration (port 5050)
```

## Démarrage rapide

```powershell
# avec Docker (recommandé)
docker compose up -d --build

# en local (nécessite un PostgreSQL accessible)
cd app
npm install
npm start
```

## Tests

```powershell
# nécessite un PostgreSQL accessible (variables DB_HOST, DB_PORT, ...)
cd app
npm test
```

## Endpoints

- `GET /produits` : liste tous les produits
- `POST /produits` : crée un produit `{nom, prix, quantite}`
- `PUT /produits/:id` : modifie un produit
- `DELETE /produits/:id` : supprime un produit
- `GET /health` : vérifie que l'API est vivante

Exemple :

```powershell
curl -X POST http://localhost:5000/produits `
  -H "Content-Type: application/json" `
  -d '{\"nom\":\"Casque\",\"prix\":49.99}'
```

## Feuille de route d'apprentissage

Chaque étape = un concept + un changement concret dans ce dépôt.
L'objectif final : un pipeline complet, reproductible et transférable.

📚 **Le détail de chaque étape est documenté dans [`docs/`](docs/) — un fichier
par chapitre, avec les concepts, les commandes et la partie réutilisable.**

### Étape 0 — Fondations (fait)
- [x] Application Node.js + PostgreSQL
- [x] Conteneurisation (Dockerfile + docker-compose)
- Concepts : images, conteneurs, volumes, réseaux, services

### Étape 1 — Git & GitHub (fait)
- [x] `git init`, `.gitignore`, README
- [x] Conventional commits, branches, pull requests
- Concepts : versionnement, collaboration, revue de code

### Étape 2 — Tests (fait)
- [x] Tests unitaires (`node:test` + supertest)
- [x] Test d'intégration avec vraie base
- Concepts : pourquoi un pipeline sans tests ne sert à rien

### Étape 3 — CI avec GitHub Actions (fait)
- [x] Workflow : tests + build image à chaque push/PR
- Concepts : intégration continue, boucle de feedback rapide, badge

### Étape 4 — Jenkins & DockerHub (fait)
- [x] Pipeline Jenkins : Build → Test → Push
- [x] Tags d'image versionnés, credentials
- Concepts : CD, registre d'images, immutabilité des artefacts

### Étape 5 — DevSecOps (brique par brique)
- [x] 5a. Détection de secrets (gitleaks) — ne jamais commiter un secret
- [ ] 5b. SAST : analyse statique du code (semgrep)
- [ ] 5c. Dépendances : audit des CVE (npm audit, trivy)
- [ ] 5d. Image : scan (trivy), utilisateur non-root, HEALTHCHECK
- Concept clé : « shift-left » — détecter les problèmes tôt dans le pipeline

### Étape 6 — Déploiement réel
- [ ] Healthcheck, logs, déploiement sur un serveur
- Concepts : environnements, rollback, mise en prod sans peur

### Étape 7 — Multirepo
- [ ] Séparer app / infra / pipelines dans des dépôts dédiés
- Concepts : couplage faible, versionnement indépendant

### Horizon (après ce TP)
Kubernetes · Terraform (IaC) · observabilité (Prometheus/Grafana) · GitOps (ArgoCD)

## Structure

```
.
├── app/
│   ├── server.js          # application Express
│   ├── test/api.test.js   # tests (node:test + supertest)
│   ├── package.json       # dépendances + scripts
│   ├── Dockerfile         # image de l'API
│   └── .dockerignore
├── db/init.sql            # schéma + données de démo
├── docker-compose.yml     # orchestration locale
└── Jenkinsfile            # pipeline Jenkins (étape 4)
```
