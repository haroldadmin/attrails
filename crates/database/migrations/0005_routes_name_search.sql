-- Full text search over route names.
--
-- Route records don't declare a language, so we use the 'simple'
-- config: tokens are lowercased, with no stemming or stop words.
--
-- Postgres 18 defaults generated columns to VIRTUAL, which can't be
-- indexed, so the column must be explicitly STORED.

ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS name_tsv TSVECTOR NOT NULL
    GENERATED ALWAYS AS (to_tsvector('simple', name)) STORED;

CREATE INDEX IF NOT EXISTS routes_name_tsv_idx ON routes USING gin (name_tsv);
