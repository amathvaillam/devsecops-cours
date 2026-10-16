
// Fichier d'exercice — volontairement vulnerable (ne pas reproduire !)
const id = "42";
const code = eval("1 + 1");

async function chercheProduit(pool, req) {
  return pool.query("SELECT * FROM produits WHERE id = " + req.params.id);
}