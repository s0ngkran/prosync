-- Add UUID slug column to documents for safe public URLs
ALTER TABLE documents ADD COLUMN IF NOT EXISTS slug VARCHAR(36);

-- Backfill existing documents with UUID
UPDATE documents SET slug = gen_random_uuid()::varchar(36) WHERE slug IS NULL;

-- Make NOT NULL + unique after backfill
ALTER TABLE documents ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_slug ON documents(slug);
