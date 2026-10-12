# Chapitre 03 — Les tests

Objectif : écrire des tests qui vérifient réellement le comportement de l'API,
et comprendre la différence entre test unitaire et test d'intégration.

## 1. Pourquoi les tests AVANT la CI

Un pipeline qui automatise un build sans rien vérifier ne sert à rien : il
transforme un code cassé en artefact cassé, plus vite. La CI n'a de valeur
que si elle exécute des tests capables de détecter un bug.

## 2. Unitaire vs intégration

- **Test unitaire** : teste un morceau isolé, sans dépendance externe
  (notre test de `GET /health`). Rapide, stable, mais ne prouve pas que
  l'ensemble fonctionne.
- **Test d'intégration** : teste le système connecté à ses vraies dépendances
  (nos tests CRUD contre une vraie base PostgreSQL). Plus lent, mais c'est là
  que vivent les vrais bugs (SQL, connexions, sérialisation).

Une suite saine a les deux.

## 3. Notre outillage

- **`node:test`** : le framework de test intégré à Node (zéro dépendance)
- **`supertest`** : lance des requêtes HTTP contre l'app Express sans ouvrir
  de port réseau — parfait pour tester des API
- **`assert`** : vérifie les résultats (`assert.equal`, `assert.deepEqual`…)

## 4. Les deux patterns clés de notre refactor

Dans `server.js` :

```js
if (require.main === module) {
  app.listen(PORT, ...)      // n'écoute QUE si lancé directement
}
module.exports = app;        // exportée pour être importée par les tests
```

Dans `test/api.test.js` : les variables d'environnement sont définies
**avant** `require("../server")`, car le pool pg les lit au chargement.

## 5. La base jetable (reprise du chapitre 01)

Les tests d'intégration ont besoin d'une vraie base. On en démarre une
**jetable** : état identique à chaque run, zéro pollution de la base de dev.

```powershell
docker run -d --name tpcrud-test-db -e POSTGRES_USER=tpuser `
  -e POSTGRES_PASSWORD=tppassword -e POSTGRES_DB=tpdb -p 5545:5432 `
  -v "chemin\init.sql:/docker-entrypoint-initdb.d/init.sql:ro" postgres:16-alpine

$env:DB_HOST="localhost"; $env:DB_PORT="5545"; $env:DB_NAME="tpdb"
$env:DB_USER="tpuser"; $env:DB_PASSWORD="tppassword"
npm test

docker rm -f tpcrud-test-db
```

## 6. `npm ci` vs `npm install`

- `npm install` : résout les versions, peut modifier le lockfile
- `npm ci` : installe **exactement** ce que dit `package-lock.json`, en
  repartant de zéro (supprime node_modules). Déterministe → c'est lui qu'on
  utilise en CI.

## Vérification

- [x] `npm test` : 7 tests passent (1 unitaire + 6 intégration)
- [x] Le test 404 prouve que les cas d'erreur sont couverts
- [x] La base jetable est supprimée après les tests

## Réutilisable : quoi copier, quoi changer

- La structure `test/*.test.js` + `npm test` : universelle en Node
- Le pattern `module.exports = app` + `require.main` : à reprendre tel quel
  dans toute API Express testable
- La base jetable : même démarche avec MySQL/Redis/Mongo
