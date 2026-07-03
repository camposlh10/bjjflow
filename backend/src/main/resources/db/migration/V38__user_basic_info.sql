-- Richer profile basics captured at signup. (city already exists from V3.)
ALTER TABLE users ADD COLUMN first_name          VARCHAR(60);
ALTER TABLE users ADD COLUMN last_name           VARCHAR(60);
ALTER TABLE users ADD COLUMN gender              VARCHAR(20);   -- MALE | FEMALE | OTHER | UNDISCLOSED
ALTER TABLE users ADD COLUMN favorite_art        VARCHAR(40);   -- BJJ | NOGI | JUDO | WRESTLING | MUAY_THAI | MMA | BOXING | KARATE | OTHER
ALTER TABLE users ADD COLUMN training_start_year INT;
