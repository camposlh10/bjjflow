ALTER TABLE gyms ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gyms ADD COLUMN instagram VARCHAR(255);
ALTER TABLE gyms ADD COLUMN facebook VARCHAR(255);
ALTER TABLE gyms ADD COLUMN whatsapp VARCHAR(50);
ALTER TABLE gyms ADD COLUMN youtube VARCHAR(255);
ALTER TABLE gyms ADD COLUMN google_place_id VARCHAR(150);

-- Academias seed (nomes conhecidos) já entram verificadas
UPDATE gyms SET verified = TRUE
WHERE invite_code IN ('GBCENTRO', 'ALLTAT', 'CHKVM', 'GFCOPA', 'NUTIJ', 'ATOSBH', 'CTLEAO', 'SOULFLP');
