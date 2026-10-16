// Version corrigee : les motifs dangereux ont ete remplaces par leurs equivalents surs
const id = Number("42");

async function chercheProduit(pool, req) {
  // Requete parametree : la valeur voyage separement du SQL
  return pool.query("SELECT * FROM produits WHERE id = $1", [req.params.id]);
}