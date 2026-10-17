# Chapitre 06 — DevSecOps ✅

> ✅ **Chapitre terminé** — 5a (gitleaks) · 5b (semgrep) · 5c (npm audit) ·
> 5d (trivy + durcissement) · 5e (DAST ZAP, scan vérifié).

Objectif : ajouter la sécurité au pipeline existant, en la déplaçant **le plus
tôt possible** dans la chaîne — c'est le « shift-left ». Placement de chaque
brique : voir [Rôles des pipelines](pipeline-roles.md).

---

## 5a. Détection de secrets — gitleaks ✅

**Ce qui a été construit** : un job `secrets` dans `.github/workflows/ci.yml`
(GH Actions, sur PR — la porte d'entrée) :

- `actions/checkout@v4` avec **`fetch-depth: 0`** — indispensable : sans ça le
  checkout ne récupère qu'un commit et gitleaks ne voit pas l'historique
- Scan dans Docker, **même image et même commande qu'en local** :
  `ghcr.io/gitleaks/gitleaks:latest detect --source=/repo --no-banner`
- Code de sortie : `0` = propre, `1` = fuite trouvée → la CI échoue (le
  mécanisme du blocage)

**L'exercice du faux secret (vécu)** :

1. Branche `exercice/faux-secret` + un fichier avec un faux token GitHub
   (`ghp_…`) → PR → **gitleaks rouge** : `19 commits scanned. leaks found: 1`
2. **Le piège** : le « fix évident » (`git rm` + nouveau commit) ne passe PAS.
   Le commit qui a **ajouté** le secret reste dans l'historique — gitleaks
   relit tous les commits. *On n'efface pas le passé avec un nouveau commit :
   on le réécrit.*
3. **La réécriture** : `git reset --hard HEAD~2` (la branche repart sur main)
   puis `git push --force-with-lease` (le « force » propre : il refuse si
   quelqu'un a poussé entre-temps — jamais `--force` nu)
4. PR **fermée sans merge** — on ne merge jamais une branche qui a contenu un
   secret, même faux.

**La hiérarchie à retenir (incident réel)** :

1. **RÉVOQUER** le secret chez le fournisseur — toujours en premier, sans
   exception. Le nettoyage ne « dé-expose » rien.
2. Réécrire l'historique ensuite — de l'hygiène, pas une guérison.
3. Même après réécriture, les vieux commits traînent : reflog local (~90
   jours), objets orphelins et réf. de PR côté GitHub. Seule la révocation
   protège vraiment.

**Pièges vécus** :

- Le log CI ne montre que le résumé (`leaks found: 1`) — le détail s'obtient
  en local avec `--verbose`
- `fetch-depth: 0` obligatoire, sinon le scan est aveugle à l'historique
- Notre job scanne l'historique **complet** : plus strict que les setups qui
  ne scannent que les nouveaux commits d'une PR

---

## 5b. Analyse statique (SAST) — semgrep ✅

**Ce qui a été construit** :

- `.semgrep.yml` **dans le repo** — deux règles maison, versionnées :
  - `no-eval` : `pattern: eval(...)`
  - `no-sql-concat` : `$POOL.query($SQL + $X, ...)` (les deux ordres)
- Job `sast` dans `.github/workflows/ci.yml` (GH Actions, sur PR) :
  `semgrep scan --config .semgrep.yml --metrics=off --error`

**Pourquoi des règles maison ?** Les packs publics existent, mais leurs règles
fines (taint analysis) ne matchaient pas nos échantillons minimaux. Écrire nos
règles enseigne la mécanique : **une règle SAST = un motif sur l'arbre
syntaxique**. Notre requête paramétrée sûre (`"… $1", [...]`) **ne matche
pas** le motif de concaténation — le fix est prescrit par la règle.

**L'exercice du code vulnérable (vécu)** :

1. `eval(...)` + `pool.query("SELECT … " + req.params.id)` → PR →
   **`2 Code Findings, 2 blocking`**
2. **Run rouge chirurgical** : SEUL semgrep a échoué (tests ✓, build ✓,
   gitleaks ✓) — chaque scanner voit un angle différent.
3. **Fix par commit** : version sûre (`Number()`, requête paramétrée `$1`)
   → vert.
   > ⚡ Contraste : semgrep scanne **l'état actuel** du code → un fix par
   > commit suffit. Gitleaks relit le passé → il faut réécrire l'historique.

---

## 5c. Les CVE des dépendances — npm audit ✅

**Ce qui a été construit** : job `audit` dans `.github/workflows/ci.yml`
(GH Actions, sur PR) : `npm audit --audit-level=high` (lit le lockfile).
Politique : échoue sur HIGH/CRITICAL.

**L'exercice de la dépendance vérolée (vécu)** :

1. `npm install lodash@4.17.15` → **3 vulnérabilités** visibles dès le local
   (prototype pollution, injection de commande, ReDoS).
2. PR → audit **✗ rouge**, les 4 autres jobs verts : le *code* va bien, c'est
   la *lib* qui est malade.
3. **Fix par upgrade** (`^4.18.1`, la dernière) → `found 0 vulnerabilities`
   → vert.

**Le menu de remédiation** : upgrader (le standard) · remplacer · retirer
(si inutilisée) · accepter en connaissance de cause (risque documenté).

**La leçon** : la popularité ne protège pas — **la fraîcheur des versions,
si**.

**Incident vécu** : panne DNS transitoire (`Could not resolve host:
github.com`) → simple retry. Réflexe d'ops : identifier la couche qui casse
(réseau ? DNS ? auth ? proxy ?) avant de suspecter git.

---

## 5d. Image : trivy + durcissement ✅

**Ce qui a été construit** :

- **Dockerfile durci** : utilisateur non-root (`app`) + `HEALTHCHECK` sur
  `/health` (interval 30 s, wget BusyBox)
- **Stage `Scan image (trivy)`** entre Test et Push dans le Jenkinsfile :
  `trivy image --severity HIGH,CRITICAL --exit-code 1 --skip-dirs usr/local/lib/node_modules/npm`
- Si le scan échoue → `Push DockerHub` est **sauté** : l'image vulnérable ne
  sort jamais du pipeline

**L'exercice (vécu, en deux temps)** :

1. Premier scan sur `node:20-alpine` : **27 findings** — OS 4 HIGH (OpenSSL) +
   outillage npm 22 HIGH + 1 CRITICAL → `Push… skipped` = **le gate a bloqué
   la publication** (comportement voulu !).
2. Diagnostic : les 23 findings Node étaient dans
   `usr/local/lib/node_modules/npm/**` — l'**outillage bundlé de l'image de
   base**, PAS les dépendances applicatives (npm audit = 0).
3. **Upgrade de la base** : `node:20-alpine` → **`node:24-alpine`** →
   de 27 à **4 HIGH** (l'OS et le CRITICAL disparus).
4. **Calibration documentée** : les 4 restants = outillage npm non utilisé au
   runtime → `--skip-dirs usr/local/lib/node_modules/npm`, avec commentaire
   justificatif dans le Jenkinsfile (OS + deps applicatives restent scannés
   strictement).
5. Build final : `Build → Test → Scan ✅ → Push DockerHub` — **première image
   publiée derrière un gate vert** (tag 21).

**Pièges vécus** :

- `npm ci` dans l'image non-root → **EACCES** → `--user root` pour le
  conteneur de **test** uniquement (l'image livrée reste non-root)
- trivy re-télécharge sa base à chaque `docker run --rm` → volume cache en
  local ; en CI le premier scan est plus long
- **ECONNREFUSED** transitoire vers registry.npmjs.org pendant `npm ci` →
  retry par **redelivery du webhook** : les pannes réseau arrivent, le
  pipeline doit être rejouable
- 🔑 une même CVE peut changer de sévérité selon le fournisseur (trivy le
  signale) — la politique de gate se **date et se révise**

**La leçon** : un gate strict n'est pas un gate qu'on laisse bloquer pour
toujours — on **calibre avec justification** : audit d'abord (toutes
sévérités), puis seuil choisi, puis exception documentée et révisable.
Recette complète : [TP 02](tp-02-image-durcie-trivy.md).

---

## 5e. Scan dynamique (DAST) — OWASP ZAP baseline ✅

**Ce qui a été construit** : un stage `6. DAST (ZAP baseline)` dans le
Jenkinsfile, **après le déploiement** (un scan dynamique a besoin d'une cible
vivante) :

- image `zaproxy/zap-stable` (Docker Hub) ;
- `--user root -v zap-wrk:/zap/wrk` : le script exige un volume monté sur
  `/zap/wrk`, et l'image tourne en utilisateur `zap` (d'où root pour écrire) ;
- cible `http://host.docker.internal:5002/produits` : le port publié par
  `compose.prod.yml`, vu depuis le conteneur de scan ;
- `-I` : les WARN ne font pas échouer le scan ; **mode rapport** (`|| true`)
  tant que la politique n'est pas calibrée ;
- `docker cp` récupère le rapport dans le workspace, `archiveArtifacts` le
  publie sur la page du build. **Pas de `|| true` sur le `docker cp`** :
  sans rapport, le stage échoue — sinon un scan qui n'a jamais tourné passe
  pour un succès (c'est exactement ce qui s'est produit au build 25).

**Ce que le premier scan a trouvé** : 5 URLs, **0 FAIL, 6 WARN, 61 PASS**.
Les 6 WARN sont des durcissements d'en-têtes HTTP, pas des vulnérabilités
exploitables :

- `X-Content-Type-Options` absent ;
- `X-Powered-By` (fuite de technologie) ;
- contenu stockable/cacheable ;
- CSP : directive sans fallback ;
- `Permissions-Policy` absent ;
- `Cross-Origin-Resource-Policy` absent ou invalide.

**Pièges vécus** :

- `ghcr.io/zaproxy/zap-stable` → **`denied`** en anonyme depuis ce Jenkins :
  on bascule sur l'image Docker Hub `zaproxy/zap-stable` ;
- sans volume sur `/zap/wrk`, `zap-baseline.py` refuse de démarrer
  (`directory '/zap/wrk' is not mounted`) ;
- volume monté en root + image non-root → `Permission denied` sur
  `zap.yaml` : `--user root` pour ce conteneur de scan éphémère ;
- Jenkins tourne lui-même dans un conteneur (Docker-outside-of-Docker) :
  un bind mount de `$(pwd)` ne marcherait pas (le démon Docker ne voit pas
  le workspace Jenkins). Un **volume nommé** + `docker cp` fonctionne, car
  `docker cp` passe par l'API Docker ;
- `|| true` sur le scan (mode rapport) **mais pas** sur la récupération du
  rapport : un outil qui n'a pas tourné ne doit pas être vert.

**Vérification** :

- [x] Scan exécuté : 0 FAIL / 6 WARN / 61 PASS, rapport HTML de 52 Ko
- [x] `host.docker.internal` et `docker cp` validés depuis le conteneur Jenkins
- [ ] Build Jenkins complet avec rapport archivé (après merge du correctif)

**Réutilisable** : la recette « ZAP baseline dans un Jenkins conteneurisé » —
image Docker Hub, volume nommé pour `/zap/wrk`, `--user root`, cible
`host.docker.internal:<port publié>`, `docker cp` + `archiveArtifacts`, et un
échec franc si le rapport manque.

---

## Le concept clé

« Shift-left » : plus un problème est détecté tôt (écriture du code → commit →
CI → prod), moins il coûte cher à corriger. Chaque brique se place à un étage
différent du pipeline.

## Vérification

- [x] Un secret factice est détecté par gitleaks (règle `github-pat`)
- [x] Le « fix évident » (rm) échoue — et on sait POURQUOI (historique immuable)
- [x] Réécriture maîtrisée : `reset --hard` + `push --force-with-lease`
- [x] Un code vulnérable factice est détecté par semgrep (2 findings bloquants)
- [x] Run rouge chirurgical (seul semgrep échoue) puis vert après fix par commit
- [x] Une dépendance vulnérable factice est détectée par l'audit (lodash 4.17.15 → 3 CVE)
- [x] Le fix par upgrade suffit (0 vulnérabilité, CI verte)
- [x] Image non-root (`whoami` → `app`) + HEALTHCHECK (`(healthy)`)
- [x] Gate trivy entre Test et Push : a bloqué 27 puis 4 findings (skip → pas de push)
- [x] Calibration documentée (`--skip-dirs` outillage npm) + base `node:24-alpine`
- [x] Push DockerHub derrière un gate vert (tag 21)
- [x] Scan ZAP baseline : 0 FAIL / 6 WARN / 61 PASS, rapport HTML généré
- [ ] Build Jenkins avec rapport ZAP archivé (après merge du correctif)

## Réutilisable : quoi copier, quoi changer

- Les jobs `secrets`, `sast` et `audit` de `ci.yml` : copiables tels quels
- `.semgrep.yml` : adapter les règles au langage/au projet
- Le Dockerfile durci + le stage trivy : voir la recette
  [TP 02](tp-02-image-durcie-trivy.md) (politiques de sévérité incluses)
- Le stage DAST ZAP du Jenkinsfile : recette détaillée dans la section 5e
  (image Docker Hub, volume `/zap/wrk`, `docker cp`, rapport obligatoire)
- La hiérarchie « révoquer → réécrire → ne jamais compter sur le nettoyage » :
  universelle, à garder en tête pour toute fuite
