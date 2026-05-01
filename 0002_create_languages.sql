-- =============================================================================
-- Migration: 0002_create_languages.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the supported_languages table and seed initial language rows.
--
-- Why this migration runs second:
--   Every table that carries a default_language column or a language-code
--   foreign key depends on this table existing first. Creating it immediately
--   after enums (0001) lets all subsequent migrations declare FK references
--   safely without forward-reference problems.
--
-- Design notes:
--   - Integer identity PK: this is a small, stable lookup table.
--     UUID is unnecessary overhead for a registry that will rarely exceed
--     a few dozen rows.
--   - code is the natural unique key and is used as the FK target in all
--     other tables (e.g. profiles.preferred_language → supported_languages.code).
--   - is_rtl is included even though the spec omits it. Arabic, Hebrew, and
--     other RTL languages will be added later; storing the flag now avoids
--     a schema migration at that point.
--   - is_default from the spec is intentionally omitted in this migration
--     per the stated requirements. It can be added via ALTER TABLE later
--     if a single-row "system default language" concept is needed.
--   - All timestamps are stored in UTC (timestamptz).
--   - updated_at is maintained by a reusable trigger function defined here.
--     The same function will be reused by subsequent table migrations.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: set_updated_at
-- Reusable BEFORE UPDATE trigger that sets updated_at = now() on every row
-- update. Created once here; all subsequent table migrations reference it by
-- name using:
--   CREATE TRIGGER trg_set_updated_at
--   BEFORE UPDATE ON <table_name>
--   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at() IS
  'Reusable BEFORE UPDATE trigger function. Sets updated_at = now() on every '
  'row update. Applied to all tables that carry an updated_at column.';


-- -----------------------------------------------------------------------------
-- TABLE: supported_languages
-- Registry of all language codes the platform recognises.
-- Adding a new language requires only a new INSERT here — no schema changes.
-- -----------------------------------------------------------------------------
CREATE TABLE supported_languages (
  id          integer      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text         NOT NULL,
  name        text         NOT NULL,
  native_name text         NOT NULL,
  is_rtl      boolean      NOT NULL DEFAULT false,
  is_active   boolean      NOT NULL DEFAULT true,
  sort_order  integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE supported_languages IS
  'Registry of language codes supported by the platform. '
  'All default_language and preferred_language columns reference code from this table. '
  'Adding a language requires only a new row — no schema changes needed.';

COMMENT ON COLUMN supported_languages.code IS
  'BCP 47 language tag used as the natural unique key across the platform '
  '(e.g. en, ko, th, ja, zh, es). Referenced as a text FK in profiles, '
  'organizations, churches, groups, cohorts, and user_language_preferences.';

COMMENT ON COLUMN supported_languages.name IS
  'English display name of the language (e.g. English, Korean, Thai).';

COMMENT ON COLUMN supported_languages.native_name IS
  'Language name written in the language itself (e.g. English, 한국어, ไทย). '
  'Used in language-picker UI so users can identify their language without '
  'needing to read English first.';

COMMENT ON COLUMN supported_languages.is_rtl IS
  'True if the language reads right-to-left (e.g. Arabic, Hebrew). '
  'UI components use this flag to apply RTL layout direction.';

COMMENT ON COLUMN supported_languages.is_active IS
  'False hides the language from all pickers and UI without deleting the row. '
  'Useful for temporarily disabling a language whose translations are incomplete.';

COMMENT ON COLUMN supported_languages.sort_order IS
  'Controls display order in language-selection UI. '
  'Lower values appear first. Default: en=1, ko=2, th=3.';


-- -----------------------------------------------------------------------------
-- UNIQUE CONSTRAINT
-- code must be unique across the table.
-- Named constraint (not inline) so it can be referenced in ON CONFLICT clauses
-- and in FK definitions from other tables.
-- -----------------------------------------------------------------------------
ALTER TABLE supported_languages
  ADD CONSTRAINT uq_supported_languages_code UNIQUE (code);


-- -----------------------------------------------------------------------------
-- INDEXES
-- code is the primary lookup key for all language resolution queries.
-- The unique constraint above creates an index automatically, but the explicit
-- index name is documented here for clarity.
--
-- is_active index supports the common query pattern:
--   SELECT * FROM supported_languages WHERE is_active = true ORDER BY sort_order
-- -----------------------------------------------------------------------------
CREATE INDEX idx_supported_languages_is_active
  ON supported_languages (is_active, sort_order);


-- -----------------------------------------------------------------------------
-- TRIGGER: updated_at
-- Uses the reusable set_updated_at() function defined above.
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_supported_languages_set_updated_at
  BEFORE UPDATE ON supported_languages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- SEED DATA
-- Three initial language rows required by the spec.
--
-- Insertion order reflects priority:
--   en (sort_order 1) — system fallback language per spec
--   ko (sort_order 2) — primary platform language per spec
--   th (sort_order 3) — first expansion language per spec
--
-- ON CONFLICT DO NOTHING makes this block idempotent:
--   - Safe to re-run the migration file without errors or duplicate rows.
--   - Safe to apply in environments where seed data was already inserted
--     by a separate process.
-- -----------------------------------------------------------------------------
INSERT INTO supported_languages (code, name, native_name, is_rtl, is_active, sort_order)
VALUES
  ('en', 'English', 'English', false, true, 1),
  ('ko', 'Korean',  '한국어',   false, true, 2),
  ('th', 'Thai',    'ไทย',      false, true, 3)
ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- End of 0002_create_languages.sql
-- Objects created:
--   FUNCTION  set_updated_at()                           (reusable)
--   TABLE     supported_languages                        (1 table)
--   CONSTRAINT uq_supported_languages_code              (unique)
--   INDEX     idx_supported_languages_is_active         (composite)
--   TRIGGER   trg_supported_languages_set_updated_at    (updated_at)
--   ROWS      en, ko, th                                (3 seed rows)
-- =============================================================================
