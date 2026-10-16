# Chapitre 06 — DevSecOps

> 🔄 En cours — briques **5a (gitleaks)**, **5b (semgrep)** et **5c (npm
> audit)** terminées. Brique 5d à venir.

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
   secret, même faux (le commit resterait dans l'historique de main pour
   toujours → gitleaks hurlerait sur chaque PR future).

**La hiérarchie à retenir (incident réel)** :

1. **RÉVOQUER** le secret chez le fournisseur — toujours en premier, sans
   exception. Le nettoyage ne « dé-expose » rien : le secret a pu être cloné,
   forké, scrapé (des robots lisent GitHub en temps réel).
2. Réécrire l'historique ensuite — de l'hygiène, pas une guérison.
3. Même après réécriture, les vieux commits traînent : reflog local (~90
   jours), objets orphelins et réf. de PR côté GitHub. Seule la révocation
   protège vraiment.

**Pièges vécus** :

- Le log CI ne montre que le résumé (`leaks found: 1`) — le détail (règle,
  fichier, commit) s'obtient en local avec `--verbose`
- `fetch-depth: 0` obligatoire, sinon le scan est aveugle à l'historique
- Notre job scanne l'historique **complet** : plus strict que les setups qui
  ne scannent que les nouveaux commits d'une PR (chez eux, un `rm`-commit
  « passerait » en cachant la fuite sous le tapis)

---

## 5b. Analyse statique (SAST) — semgrep ✅

**Ce qui a été construit** :

- `.semgrep.yml` **dans le repo** — nos deux règles maison, versionnées avec
  le code, comme le Jenkinsfile :
  - `no-eval` : `pattern: eval(...)` — tout appel à eval, quels qu'arguments
  - `no-sql-concat` : `$POOL.query($SQL + $X, ...)` — concaténation dans une
    requête (dans les deux ordres `$SQL + $X` et `$X + $SQL`)
- Job `sast` dans `.github/workflows/ci.yml` (GH Actions, sur PR) :
  `semgrep scan --config .semgrep.yml --metrics=off --error`
- `--error` : tout finding = code de sortie ≠ 0 = CI rouge

**Pourquoi des règles maison ?** Les packs publics (p/javascript, p/nodejs…)
existent, mais leurs règles fines (taint analysis) ne matchaient pas nos
échantillons minimaux. Écrire nos règles enseigne la mécanique : **une règle
SAST = un motif sur l'arbre syntaxique du code**. Les `$X` sont des
variables-motifs, `...` un joker. Notre requête paramétrée sûre
(`"… $1", [req.params.id]`) **ne matche pas** le motif de concaténation — le
fix est prescrit par la règle elle-même.

**L'exercice du code vulnérable (vécu)** :

1. Un fichier avec `eval(...)` + `pool.query("SELECT … " + req.params.id)`
   → PR → **`2 Code Findings, 2 blocking`**
2. **Le run rouge était chirurgical** : sur les 4 jobs, SEUL semgrep a
   échoué (tests ✓, build ✓, gitleaks ✓) — chaque scanner voit une chose que
   les autres ne voient pas. C'est pour ça qu'on les empile.
3. **Le fix par commit a suffi** : réécriture du fichier en version sûre
   (`Number()` au lieu d'`eval`, requête paramétrée avec `$1`) → CI verte.

> ⚡ **Le contraste du chapitre** : semgrep scanne **l'état actuel** du code
> (pas l'historique) → un fix par commit suffit. Gitleaks (5a) relit tout le
> passé → il fallait **réécrire l'historique**. Deux scanners, deux
> philosophies — tu as vécu les deux.

**Notes** :

- Le message de la règle guide le fix (« Utiliser les parametres ($1, $2) »)
  — un bon finding est pédagogique
- L'image semgrep est volumineuse (~2 Go) → premier run CI plus long
- `--config auto` exige les metrics activés (incompatible avec `--metrics=off`)

---

## 5c. Les CVE des dépendances — npm audit ✅

**Ce qui a été construit** : job `audit` dans `.github/workflows/ci.yml`
(GH Actions, sur PR) : `npm audit --audit-level=high` (lit le lockfile).
Politique : le job échoue sur les CVE **high/critical** — les moderate
s'affichent sans bloquer.

**L'exercice de la dépendance vérolée (vécu)** :

1. `npm install lodash@4.17.15` — une des libs les plus populaires du monde,
   en version un peu ancienne → **3 vulnérabilités** visibles dès le local
   (prototype pollution, injection de commande, ReDoS). npm audit documente
   chaque CVE : identifiant, sévérité, chemin.
2. Commit + PR → audit **✗ rouge** — et les 4 autres jobs verts : le *code*
   va bien, c'est la *lib* qui est malade (encore un angle différent !).
3. **Le fix par upgrade** : lodash mis à jour vers la version patchée
   (`^4.18.1`, la dernière) → `found 0 vulnerabilities` → audit **✓ vert**.

**Le menu de remédiation (à retenir)** :

- **Upgrader** (le fix standard, presque toujours gagnant)
- Remplacer la lib par une alternative
- Retirer (si inutilisée)
- Ou **accepter en connaissance de cause** — avec une évaluation du risque
  documentée (parfois une CVE n'est pas exploitable dans ton contexte)

**La leçon** : la popularité ne protège pas — **la fraîcheur des versions,
si**. On met à jour régulièrement, même « quand tout marche ».

**Incident vécu** : panne DNS transitoire (`Could not resolve host:
github.com`) pendant un push → simple retry après retour du réseau. Le
réflexe d'ops : **identifier la couche qui casse** (réseau ? DNS ? auth ?
proxy ?) avant de suspecter git.

## 5d. Image — trivy + durcissement (à venir)

Objectif : scanner l'image construite (Jenkins, avant le push), utilisateur
non-root, HEALTHCHECK.

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
- [ ] L'image est scannée et tourne en non-root (5d)

## Réutilisable : quoi copier, quoi changer

- Les jobs `secrets`, `sast` et `audit` de `ci.yml` : copiables tels quels
- `.semgrep.yml` : adapter les règles au langage/au projet
- La hiérarchie « révoquer → réécrire → ne jamais compter sur le nettoyage » :
  universelle, à garder en tête pour toute fuite
