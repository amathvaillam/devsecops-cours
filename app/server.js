const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// GET /produits — liste tous les produits
app.get("/produits", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, nom, prix, quantite FROM produits ORDER BY id;"
  );
  res.json(rows.map((r) => ({ ...r, prix: Number(r.prix) })));
});

// POST /produits — crée un produit
app.post("/produits", async (req, res) => {
  const { nom, prix, quantite = 0 } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO produits (nom, prix, quantite) VALUES ($1, $2, $3) RETURNING id;",
    [nom, prix, quantite]
  );
  res.status(201).json({ id: rows[0].id });
});

// PUT /produits/:id — modifie un produit
app.put("/produits/:id", async (req, res) => {
  const { nom, prix, quantite = 0 } = req.body ;
  const { rowCount } = await pool.query(
    "UPDATE produits SET nom = $1, prix = $2, quantite = $3 WHERE id = $4;",
    [nom, prix, quantite, req.params.id]
  );
  if (rowCount === 0) {
    return res.status(404).json({ error: "not found" });
  }
  res.json({ status: "updated" });
});

// DELETE /produits/:id — supprime un produit
app.delete("/produits/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM produits WHERE id = $1;",
    [req.params.id]
  );
  if (rowCount === 0) {
    return res.status(404).json({ error: "not found" });
  }
  res.json({ status: "deleted" });
});

// GET /health — vérifie que l'API est vivante (sans toucher à la base)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Gestionnaire d'erreurs global (Express 5 y envoie les erreurs des handlers async)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

// L'app n'écoute que lorsqu'elle est lancée directement (node server.js),
// pas lorsqu'elle est importée par les tests (require("../server")).
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API produits démarrée sur le port ${PORT}`);
  });
}

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
module.exports = app;
