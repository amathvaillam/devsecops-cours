CREATE TABLE produits (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL,
    prix NUMERIC(10, 2) NOT NULL,
    quantite INTEGER NOT NULL DEFAULT 0
);

INSERT INTO produits (nom, prix, quantite) VALUES
    ('Clavier', 29.99, 10),
    ('Souris', 19.99, 25),
    ('Ecran', 149.99, 5);
