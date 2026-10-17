# TP 02 — Image durcie + gate trivy (recette réutilisable)

> Recette transposable à **tout projet Docker** : durcir l'image (non-root,
> HEALTHCHECK) et la scanner avant publication, avec un gate bloquant.
> Vécu sur ce projet au chapitre 06 (brique 5d).

## 1. Le Dockerfile durci (modèle)

```dockerfile
FROM node:24-alpine
WORKDIR /app
# 1. Dependances d'abord (cache de couches) — prod uniquement
COPY package*.json ./
RUN npm ci --omit=dev
# 2. Puis le code
COPY . .
# 3. Securite : utilisateur non-root
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 5000
# 4. Sante : Docker verifie l'endpoint /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1
CMD ["node", "server.js"]
```

> À adapter : image de base (python/go/…), la commande d'install, l'endpoint
> de santé. Prérequis : l'app expose un endpoint type `GET /health`.

## 2. Le gate trivy dans le pipeline (modèle Jenkinsfile)

Stage à placer **entre les tests et le push** (le gate bloque la publication) :

```groovy
stage('Scan image (trivy)') {
    steps {
        sh 'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 1 --no-progress ${DOCKER_IMAGE}:${BUILD_NUMBER}'
    }
}
```

⚠️ **Conséquence du non-root** : si un stage de test lance `npm ci` (ou autre
écriture) **dans l'image**, surcharger l'utilisateur pour ce conteneur de test
uniquement :

```groovy
sh 'docker run --rm --user root ... ${DOCKER_IMAGE}:${BUILD_NUMBER} sh -c "npm ci && npm test"'
```

L'image livrée reste non-root ; le conteneur de test n'est pas l'artefact.

## 3. Les commandes locales (local-first)

### Construire et vérifier l'image

```powershell
docker build -t tp-crud:test ./app
docker run -d --name tptest -p 5001:5000 tp-crud:test
Start-Sleep -Seconds 12
docker ps --filter name=tptest            # STATUS attendu : (healthy)
docker exec tptest whoami                 # attendu : app (plus root)
docker rm -f tptest
```

### Le dry-run du gate — AVANT la PR

```powershell
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 1 --no-progress tp-crud:test
"EXIT: " + $LASTEXITCODE
```

- `exit 0` → propre pour la politique HIGH/CRITICAL → feu vert
- `exit 1` → findings → analyser avant de pousser

Optimisation (cache de la base de vulnérabilités entre les runs) :

```powershell
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache/trivy aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 1 --no-progress tp-crud:test
```

Détail des chemins des paquets (qui est vulnérable, où) :

```powershell
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --format json --quiet tp-crud:test | Select-String "FilePath"
```

## 4. La séquence complète (de la branche au build)

```powershell
git checkout main
git pull
git checkout -b fix/<sujet>
# ... éditer (Dockerfile / Jenkinsfile) ...
# ... vérifications locales (section 3) ...
git add app/Dockerfile Jenkinsfile
git commit -m "fix: image durcie + gate trivy"
git push -u origin fix/<sujet>
# PR → CI verte → merge → le webhook déclenche le build Jenkins :
#   Build → Test → Scan image (trivy) → Push
```

Si trivy échoue : `Stage "Push DockerHub" skipped` = **le gate a travaillé**
(l'image n'est pas publiée). Corriger, re-merger, attendre le build suivant.

## 5. Lire un rapport trivy

Trois couches scannées (npm audit n'en voit qu'une) :

- **OS** — alpine/debian + libs système (OpenSSL…)
- **Outillage** — ex. npm bundlé : `usr/local/lib/node_modules/npm/**`
- **Tes dépendances applicatives** — le lockfile

Statuts des findings : `fixed` (une version corrigée existe → upgrade) ·
`unfixed` (pas encore de correctif → décision de politique).

## 6. Remédiation / calibration du gate

Dans l'ordre :

1. **Mettre à jour l'image de base** (Alpine/OpenSSL/npm bundlé) — le vrai fix
2. Si restes liés à l'**outillage non utilisé au runtime** (npm), exclusion
   **documentée** : `--skip-dirs usr/local/lib/node_modules/npm`
3. `--ignore-unfixed` : ne bloquer que sur corrigeable
4. Politique de sévérité : `HIGH,CRITICAL` par défaut ; ajuster en conscience

> Règle : une exception de gate se **documente** (commentaire dans le
> Jenkinsfile + justification). Jamais silencieuse.

## 7. Pièges vécus

- **EACCES sur `npm ci`** après le passage en non-root → `--user root` pour le
  conteneur de test (jamais pour l'image livrée)
- **La base trivy se re-télécharge** à chaque `docker run --rm` → volume
  `trivy-cache:/root/.cache/trivy`
- **Le socket Docker est requis** (`-v /var/run/docker.sock:...`) : trivy doit
  voir l'image du daemon, pas de son propre conteneur
- **`Push… skipped`** après un échec = comportement normal du gate
- L'image scannée doit être **l'exact artefact publié** (même tag du build),
  pas une reconstruction

## Checklist de la recette

- [ ] Dockerfile : non-root + HEALTHCHECK (testé : `whoami` + `(healthy)`)
- [ ] Stage « Scan image » placé entre tests et push
- [ ] `--exit-code 1` présent (sinon le gate est décoratif)
- [ ] `--user root` sur le conteneur de test si npm ci écrit dans l'image
- [ ] Dry-run local vert avant la PR
- [ ] Build CI : Test vert → trivy vert → Push effectué
- [ ] Exceptions éventuelles documentées
