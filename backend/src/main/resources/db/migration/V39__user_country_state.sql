-- Mandatory location captured at signup. (city already exists from V3.)
ALTER TABLE users ADD COLUMN country VARCHAR(80);   -- e.g. "Brasil"
ALTER TABLE users ADD COLUMN state   VARCHAR(80);   -- UF sigla (e.g. "SP") for Brazil, free text otherwise
