-- =============================================================================
-- Migration: 0000_extensions.sql
-- Project:   GOThriveCoaching
-- Purpose:   Enable all required PostgreSQL extensions before any table,
--            function, or type is created in subsequent migrations.
--
-- Why this runs first (0000):
--   - 0001_create_enums.sql         requires no extensions
--   - 0002_create_languages.sql     requires no extensions
--   - 0003_create_geography.sql     uses gen_random_uuid() → requires pgcrypto
--   - All subsequent migrations     use gen_random_uuid() for UUID PKs
--
--   Running extension setup in a dedicated file at position 0000 means every
--   later migration can call gen_random_uuid() safely without repeating this
--   block or relying on Supabase auto-provisioning behaviour.
--
-- Supabase note:
--   Modern Supabase projects provision pgcrypto automatically, and PostgreSQL
--   13+ also exposes gen_random_uuid() natively via pg_catalog. However,
--   CREATE EXTENSION IF NOT EXISTS is idempotent and safe to run regardless.
--   Making the dependency explicit here keeps the migration set self-contained
--   and portable across Supabase projects, plain PostgreSQL, and CI environments.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- pgcrypto
-- Provides gen_random_uuid() used for UUID primary keys on all entity tables.
-- Also provides cryptographic functions (e.g. crypt, gen_salt) that may be
-- used for token generation in invitation and audit workflows.
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto
  WITH SCHEMA extensions;


-- -----------------------------------------------------------------------------
-- uuid-ossp  (optional belt-and-suspenders fallback)
-- Provides uuid_generate_v4() as an alternative UUID generator.
-- Included so that any tooling or third-party Supabase utilities that call
-- uuid_generate_v4() directly continue to work without modification.
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
  WITH SCHEMA extensions;


-- =============================================================================
-- End of 0000_extensions.sql
--
-- Extensions enabled:
--   pgcrypto   — gen_random_uuid(), cryptographic functions
--   uuid-ossp  — uuid_generate_v4() (fallback / tooling compatibility)
-- =============================================================================
