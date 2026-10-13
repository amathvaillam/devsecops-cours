const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Les variables d'environnement doivent être définies AVANT d'importer l'app,
// car le pool pg les lit au chargement du module.
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.DB_PORT || "5432";
process.env.DB_NAME = process.env.DB_NAME || "tpdb";
process.env.DB_USER = process.env.DB_USER || "tpuser";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "tppassword";

const app = require("../server");

let createdId;

// --- Test unitaire pur : ne touche pas à la base ---
test("GET /health répond 200 avec status ok", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "ok" });
});

// --- Tests d'intégration : vraie base PostgreSQL ---
test("POST /produits crée un produit", async () => {
  const res = await request(app)
    .post("/produits")
    .send({ nom: "Casque test", prix: 49.99, quantite: 3 });
  assert.equal(res.status, 201);
  assert.ok(res.body.id, "la réponse doit contenir un id");
  createdId = res.body.id;
});

test("GET /produits contient le produit créé", async () => {
  const res = await request(app).get("/produits");
  assert.equal(res.status, 200);
  const produit = res.body.find((p) => p.id === createdId);
  assert.ok(produit, "le produit créé doit apparaître dans la liste");
  assert.equal(produit.nom, "Casque test");
  assert.equal(produit.prix, 49.99);
  assert.equal(produit.quantite, 3);
});

test("PUT /produits/:id modifie le produit", async () => {
  const res = await request(app)
    .put(`/produits/${createdId}`)
    .send({ nom: "Casque modifié", prix: 39.99, quantite: 5 });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "updated" });
});

test("PUT /produits/:id inconnu répond 404", async () => {
  const res = await request(app)
    .put("/produits/999999")
    .send({ nom: "X", prix: 1 });
  assert.equal(res.status, 404);
});

test("DELETE /produits/:id supprime le produit", async () => {
  const res = await request(app).delete(`/produits/${createdId}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "deleted" });
});

test("DELETE /produits/:id inconnu répond 404", async () => {
  const res = await request(app).delete("/produits/999999");
  assert.equal(res.status, 404);
});
