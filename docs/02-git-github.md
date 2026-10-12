# Chapitre 02 — Git & GitHub

Objectif : maîtriser le cycle de base, les commits conventionnels, et le flux
branche → pull request → merge, qui est LE flux de travail des vraies équipes.

## 1. Les concepts

- **Dépôt local vs distant** : ton dossier = le dépôt local (`.git`) ;
  GitHub héberge la copie distante (`origin`). On travaille en local, on
  synchronise par push/pull.
- **Commit** = un instantané de ton code avec un message. Petit et atomique :
  un commit = une seule chose.
- **Branche** = une ligne de travail parallèle. `main` est la branche sacrée :
  on n'y code jamais directement.
- **Pull request (PR)** = une demande de fusion d'une branche vers `main`,
  avec revue du diff par un humain (et bientôt par la CI).

## 2. Le cycle de base (à répéter toute sa vie)

```powershell
git status        # où j'en suis ? (rouge = modifié, vert = stagé)
git add .         # préparer les changements (staging)
git commit -m "feat: description"   # figer l'instantané
git push          # envoyer sur GitHub
```

## 3. Les conventional commits

`type: description` — le type annonce l'intention :
- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `chore:` maintenance, config
- `ci:` pipeline, workflows
- `docs:` documentation
- `test:` tests

Les outils (et les humains) s'en servent pour générer des versions
automatiquement (semantic-release) et pour lire l'historique.

## 4. Le flux branche → PR → merge

```powershell
git checkout -b feat/mon-truc      # créer une branche de travail
# ... coder, committer ...
git push -u origin feat/mon-truc   # pousser la branche
# → créer la PR sur GitHub, la CI tourne, un humain relit, merge
git checkout main                  # revenir sur main
git pull                           # récupérer le merge
git branch -d feat/mon-truc        # nettoyer la branche locale
```

Sur GitHub, cocher « Delete branch » au moment du merge évite d'accumuler
des branches mortes (on en a eu une : `feat/healthcheck`).

## 5. Ce qu'on a fait dans ce projet

- `git init`, `.gitignore` (node_modules, .env), premier commit `chore:`
- branche `feat/healthcheck` → PR #1 → merge
- branche `feat/tests` → PR → merge

## Vérification

- [x] Le push réussit sans erreur « failed to push some refs »
- [x] `git status` dit « up to date with origin/main » après merge
- [x] `node_modules` n'apparaît pas dans le dépôt GitHub (`.gitignore`)

## Réutilisable : quoi copier, quoi changer

- Le `.gitignore` : adapté par langage (node_modules → venv/, target/, dist/…)
- Le rituel branche/PR/merge : identique dans tous les projets
- Les types de conventional commits : universels
