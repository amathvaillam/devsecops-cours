# TP 01 — Les remotes de A à Z (avec livraison finale)

Objectif : maîtriser `origin`, la « photo » locale, `fetch`, `pull`, `push`,
le lien de suivi (`-u`) et `--prune` — en livrant une vraie fonctionnalité à la fin.

Prérequis : chapitres 01 à 04 lus, CI en place (workflow vert), `main` synchronisée.

---

## Acte 1 — Le collègue fantôme 🎭

**Concept testé : `origin/main` est une photo, pas la réalité.**

1. Sur main, vérifie : `git status` → « up to date with 'origin/main' ».
2. **Sur GitHub** (site web) : ouvre `README.md` → crayon (Edit) → ajoute une
   ligne → *Commit changes* → « Commit directly to the main branch ».
   > C'est un commit fait « ailleurs », comme un collègue. Ta machine n'en sait rien.
3. `git status` → **toujours** « up to date » — la photo ment de bonne foi.
4. `git fetch` puis `git status` → « **behind** 'origin/main' by 1 commit ».
   `git log --oneline origin/main` → le commit apparaît dans la photo.
   `git diff main origin/main` → son contenu, pas encore récupéré.
5. `git pull` → « up to date » + le commit est dans ta copie locale.

**À retenir** : `status` compare à la photo locale (jamais à Internet) ·
`fetch` = reprendre la photo · `pull` = fetch + ramener les commits.

---

## Acte 2 — Le rouge 🔴

1. `git checkout exercice/ci-rouge` → `git status` : regarde les crochets,
   la photo est **celle de ta branche** (`origin/exercice/ci-rouge`).
2. Crée la PR (branche au test cassé) → la CI tourne → ✗ **rouge**.
   *Details* → le test `/health` échoue (attendait 999, reçu 200).

---

## Acte 3 — Ahead/behind, `push` nu vs `-u` 🎯

1. Répare le test (`999` → `200`), puis `git commit`.
   `git status` → « **ahead of** 'origin/exercice/ci-rouge' by 1 commit ».
   Les chiffres viennent de la photo locale, jamais d'Internet.
2. `git push` **sans paramètres** → fonctionne : le lien créé par `-u` existe.
   La PR re-tourne → ✓ verte.
3. Contre-épreuve : `git checkout -b bac-a-sable` puis `git push` →
   erreur **« has no upstream branch »** — git te montre la commande que le
   `-u` exécutait. Nettoyage : `git checkout main` + `git branch -d bac-a-sable`.

---

## Acte 4 — Fermer proprement + `--prune` 🧹

1. Sur GitHub : PR → *Close pull request* (sans merger) → *Delete branch*.
2. Local :
   - `git branch -d exercice/ci-rouge` → **avertissement** (voir encadré),
     la suppression passe quand même.
   - `git branch -a` → `remotes/origin/exercice/ci-rouge` est **encore là**
     (photo périmée).
   - `git fetch --prune` → `- [deleted] (none) -> origin/exercice/ci-rouge` → disparu.

> **La règle réelle de `git branch -d`** (git ≥ 2.31) : suppression autorisée si la
> branche est mergée dans **HEAD** *ou dans son **upstream***.
> - mergée dans HEAD → suppression **silencieuse**
> - mergée seulement dans son upstream → suppression **avec avertissement**
>   (`merged to 'refs/remotes/...', but not yet merged to HEAD`)
> - mergée nulle part → refus ; `-D` pour forcer (abandon assumé)

---

## Acte 5 — La livraison : `GET /produits/:id` 🚀

**Spec** : produit existant → `200` avec `{id, nom, prix, quantite}` (prix en
nombre) ; id inconnu → `404` `{"error": "not found"}`.

1. **Nouvelle branche** :

```powershell
cd "C:\Users\availlam\projets\projets perso\devops"
git checkout main
git pull
git checkout -b feat/produit-par-id
```

2. **La route** dans `app\server.js` (essaie d'abord, inspire-toi de `DELETE`) :

```js
// GET /produits/:id — récupère un produit précis
app.get("/produits/:id", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, nom, prix, quantite FROM produits WHERE id = $1;",
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "not found" });
  }
  const p = rows[0];
  res.json({ ...p, prix: Number(p.prix) });
});
```

3. **Les 2 tests** dans `app\test\api.test.js` :

```js
test("GET /produits/:id renvoie le produit existant", async () => {
  const created = await request(app)
    .post("/produits")
    .send({ nom: "Produit test GET", prix: 12.5, quantite: 2 });
  const res = await request(app).get(`/produits/${created.body.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.nom, "Produit test GET");
  assert.equal(res.body.prix, 12.5);
  await request(app).delete(`/produits/${created.body.id}`);
});

test("GET /produits/:id inconnu renvoie 404", async () => {
  const res = await request(app).get("/produits/999999");
  assert.equal(res.status, 404);
});
```

4. **Test local** (base jetable) :

```powershell
docker run -d --name tpcrud-test-db -e POSTGRES_USER=tpuser -e POSTGRES_PASSWORD=tppassword -e POSTGRES_DB=tpdb -p 5545:5432 -v "C:\Users\availlam\projets\projets perso\devops\db\init.sql:/docker-entrypoint-initdb.d/init.sql:ro" postgres:16-alpine
Start-Sleep -Seconds 10
docker exec tpcrud-test-db pg_isready -U tpuser -d tpdb

cd app
$env:DB_HOST="localhost"; $env:DB_PORT="5545"; $env:DB_NAME="tpdb"; $env:DB_USER="tpuser"; $env:DB_PASSWORD="tppassword"
npm test
docker rm -f tpcrud-test-db
cd ..
```

Attendu : **9 tests passent** (7 + 2).

5. **Commit + push -u** (branche neuve → `-u` obligatoire) :

```powershell
git add .
git commit -m "feat: endpoint GET /produits/:id avec tests"
git status        # ahead of 'origin/main' by 1 commit
git push -u origin feat/produit-par-id
```

6. **PR** → CI ✓ verte → **Merge** → *Delete branch*.

7. **C'est ici que le `-d` silencieux t'attend** :

```powershell
git checkout main
git pull
git branch -d feat/produit-par-id   # SILENCIEUX (commits dans main) — compare avec l'Acte 4 !
git fetch --prune
git branch -vv                      # main [origin/main], rien d'autre
```

**Bonus** :
- `docker compose up -d --build` puis `curl http://localhost:5000/produits/1`
  (le « Clavier » de démo), puis `docker compose down`.
- `GET /produits/abc` (id non numérique) → si ça casse, corrige (indice :
  `Number.isInteger(Number(req.params.id))`) sur une nouvelle branche.

---

## Checklist finale — ✅ TP terminé le 13/10

- [x] La photo a menti (Acte 1) puis s'est mise à jour (fetch → behind → pull)
- [x] CI rouge vue (Acte 2) puis verte (Acte 3)
- [x] `push` nu a marché (lien `-u`), l'erreur « no upstream » vue (Acte 3)
- [x] `-d` a averti, `--prune` a nettoyé (Acte 4)
- [x] PR `feat/produit-par-id` mergée, CI verte, 9/9 tests (Acte 5)
- [x] `-d` silencieux après merge (Acte 5) — le contraste avec l'Acte 4
- [x] `git branch -vv` final : `main [origin/main]`, rien d'autre

## À mémoriser

- `status` → compare à la **photo locale** (jamais à Internet)
- `fetch` → photo · `pull` → fetch + commits · `push` → envoie + photo
- `push -u` → en plus, crée le lien de suivi (obligatoire au 1er push d'une branche)
- `-d` : refuse si non mergée nulle part ; avertit si mergée upstream seulement ;
  silencieuse si mergée dans HEAD · `-D` force
- `fetch --prune` → efface les branches fantômes de la photo
