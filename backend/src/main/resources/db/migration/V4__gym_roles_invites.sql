ALTER TABLE gyms ADD COLUMN invite_code VARCHAR(12);
ALTER TABLE gyms ADD COLUMN description VARCHAR(500);
ALTER TABLE gyms ADD COLUMN graduation_target INT NOT NULL DEFAULT 40;

ALTER TABLE gym_members ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'MEMBER';

-- Backfill invite codes for the seeded gyms, then enforce NOT NULL + uniqueness
UPDATE gyms SET invite_code = 'GBCENTRO' WHERE name = 'Gracie Barra Centro';
UPDATE gyms SET invite_code = 'ALLTAT'   WHERE name = 'Alliance Tatuapé';
UPDATE gyms SET invite_code = 'CHKVM'    WHERE name = 'Checkmat Vila Mariana';
UPDATE gyms SET invite_code = 'GFCOPA'   WHERE name = 'GFTeam Copacabana';
UPDATE gyms SET invite_code = 'NUTIJ'    WHERE name = 'Nova União Tijuca';
UPDATE gyms SET invite_code = 'ATOSBH'   WHERE name = 'Atos BH Savassi';
UPDATE gyms SET invite_code = 'CTLEAO'   WHERE name = 'CT Leão Curitiba';
UPDATE gyms SET invite_code = 'SOULFLP'  WHERE name = 'Soul Fighters Floripa';

ALTER TABLE gyms ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE gyms ADD CONSTRAINT uq_gyms_invite_code UNIQUE (invite_code);
