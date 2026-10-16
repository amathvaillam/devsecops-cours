# Chapitre 06 — DevSecOps

> 🔄 En cours — brique **5a terminée** (gitleaks). Bricks 5b-5d à venir.

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

## 5b. Analyse statique (SAST) — semgrep (à venir)

Objectif : détecter les vulnérabilités dans le **code lui-même** (injections,
`eval`, pratiques dangereuses…). Placement : GH Actions, sur PR.

## 5c. Dépendances — npm audit + trivy (à venir)

Objectif : détecter les CVE connues dans les librairies embarquées.

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
- [ ] Un code vulnérable factice est détecté par semgrep (brique 5b)
- [ ] Une dépendance vulnérable factice est détectée par l'audit (5c)
- [ ] L'image est scannée et tourne en non-root (5d)

## Réutilisable : quoi copier, quoi changer

- Le job `secrets` de `ci.yml` : copiable tel quel dans n'importe quel projet
- La hiérarchie « révoquer → réécrire → ne jamais compter sur le nettoyage » :
  universelle, à garder en tête pour toute fuite
