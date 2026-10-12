# Chapitre 06 — DevSecOps

> ⏳ Chapitre à venir — on le remplira brique par brique à l'étape 5.

Objectif : ajouter la sécurité au pipeline existant, en la déplaçant **le plus
tôt possible** dans la chaîne — c'est le « shift-left ».

## Les briques prévues

- **5a. Secrets** : gitleaks — détecter un secret commité avant qu'il ne parte
  sur GitHub. Règle d'or : un secret commité est compromis à jamais.
- **5b. SAST** : semgrep — analyse statique du code (injections SQL, XSS,
  mauvaises pratiques).
- **5c. Dépendances** : `npm audit` + trivy — détecter les CVE connues dans
  les librairies qu'on embarque.
- **5d. Image** : trivy scan de l'image, utilisateur non-root, HEALTHCHECK.

## Le concept clé

« Shift-left » : plus un problème est détecté tôt (écriture du code → commit →
CI → prod), moins il coûte cher à corriger. Chaque brique de ce chapitre se
place à un étage différent du pipeline.

## Vérification (à venir)

- [ ] Un secret factice est détecté par gitleaks
- [ ] Un code vulnérable factice est détecté par semgrep
- [ ] Une dépendance vulnérable factice est détectée par l'audit
- [ ] L'image est scannée et tourne en non-root

## Réutilisable : quoi copier, quoi changer

- Les étapes de scan du workflow : copiables telles quelles
- À adapter : les règles semgrep (langage du projet), les exceptions
