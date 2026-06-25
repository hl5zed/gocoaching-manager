-- =============================================================================
-- Migration: 0004_create_growth_levels.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the growth_levels table and seed the four system levels.
--
-- This table is foundational. It is referenced by:
--   - profiles.growth_level_id        (user's current level)
--   - level_requirements.from_level_id / to_level_id
--   - level_progress_reviews.current_level_id / target_level_id
--   - level_promotion_requests.current_level_id / requested_level_id
--
-- System level protection:
--   The four seeded levels are marked is_system_level = true.
--   A BEFORE UPDATE OR DELETE trigger raises EXCEPTION if any operation
--   attempts to deactivate, soft-delete, or downgrade a system level.
--   This is intentional: system levels are part of the platform's
--   discipleship multiplication model and must not be removed by accident.
--   Only a deliberate schema migration should ever alter them.
--
-- Design notes:
--   - UUID primary key via gen_random_uuid() (requires pgcrypto from 0000).
--   - level_number: unique smallint 1–4 for the four system levels.
--   - code: unique machine-readable key (e.g. level_1) used in application
--     logic, translation keys, and RLS helper lookups.
--   - name_ko, name_en are NOT NULL; name_th is nullable to allow partial
--     translation coverage without blocking schema creation.
--   - sort_order uses multiples of 10 so future non-system levels can be
--     inserted between system levels without renumbering.
--   - deleted_at is included for soft-delete consistency with all other
--     tables. The system protection trigger prevents its use on system levels.
--   - All timestamps stored in UTC (timestamptz).
--   - updated_at maintained by set_updated_at() from 0002_create_languages.sql.
-- =============================================================================


-- =============================================================================
-- TABLE: growth_levels
-- =============================================================================
CREATE TABLE growth_levels (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number     smallint    NOT NULL,
  code             text        NOT NULL CHECK (length(trim(code)) > 0),
  name_ko          text        NOT NULL CHECK (length(trim(name_ko)) > 0),
  name_en          text        NOT NULL CHECK (length(trim(name_en)) > 0),
  name_th          text        CHECK (name_th IS NULL OR length(trim(name_th)) > 0),
  description      text,
  is_system_level  boolean     NOT NULL DEFAULT false,
  is_active        boolean     NOT NULL DEFAULT true,
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

COMMENT ON TABLE growth_levels IS
  'Defines the four growth levels of the discipleship multiplication model: '
  'Self Leadership → Coached → Coach → Coach Maker. '
  'System levels (is_system_level = true) are protected against deactivation '
  'or deletion by a trigger. Only a deliberate schema migration may alter them. '
  'This is NOT a gamification ranking — it is a disciple multiplication structure.';

COMMENT ON COLUMN growth_levels.level_number IS
  'Numeric position of the level (1–4 for system levels). '
  'Used for ordering and promotion logic comparisons. Unique across the table.';

COMMENT ON COLUMN growth_levels.code IS
  'Machine-readable unique key for this level (e.g. level_1, level_2). '
  'Used in application logic, RLS helper functions, and i18n translation keys. '
  'Example translation key: level.level_1_name.';

COMMENT ON COLUMN growth_levels.name_ko IS 'Korean display name. Required.';
COMMENT ON COLUMN growth_levels.name_en IS 'English display name. Required.';
COMMENT ON COLUMN growth_levels.name_th IS
  'Thai display name. Nullable — Thai translation may be added later '
  'without a schema change.';

COMMENT ON COLUMN growth_levels.is_system_level IS
  'True for the four platform-defined levels (level_1 through level_4). '
  'System levels cannot be deactivated, soft-deleted, or downgraded '
  'by normal operations — see trigger trg_growth_levels_system_protection. '
  'Only a deliberate schema migration should change system level definitions.';

COMMENT ON COLUMN growth_levels.is_active IS
  'False hides this level from pickers and promotion logic. '
  'Cannot be set to false for system levels (enforced by trigger).';

COMMENT ON COLUMN growth_levels.sort_order IS
  'Display order in UI. System levels use multiples of 10 (10, 20, 30, 40) '
  'so future non-system levels can be inserted between them without renumbering.';

COMMENT ON COLUMN growth_levels.deleted_at IS
  'Soft-delete timestamp. Cannot be set on system levels (enforced by trigger). '
  'Non-system levels added by organisations may be soft-deleted.';


-- -----------------------------------------------------------------------------
-- UNIQUE CONSTRAINTS
-- Both level_number and code must be globally unique.
-- Spec section 5: "growth_levels: unique(level_number), unique(code)"
-- Named constraints so they can be referenced in ON CONFLICT clauses and
-- in FK violation error messages.
-- -----------------------------------------------------------------------------
ALTER TABLE growth_levels
  ADD CONSTRAINT uq_growth_levels_level_number UNIQUE (level_number);

ALTER TABLE growth_levels
  ADD CONSTRAINT uq_growth_levels_code UNIQUE (code);


-- -----------------------------------------------------------------------------
-- INDEXES
-- level_number and code are the primary lookup keys.
-- Unique constraints above create indexes automatically.
-- Additional indexes for common query patterns:
--   - active levels for promotion logic and pickers
--   - system levels for protection checks and admin views
-- -----------------------------------------------------------------------------
CREATE INDEX idx_growth_levels_is_active
  ON growth_levels (is_active, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_growth_levels_is_system
  ON growth_levels (is_system_level)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_growth_levels_deleted_at
  ON growth_levels (deleted_at);


-- -----------------------------------------------------------------------------
-- TRIGGER: updated_at
-- Reuses set_updated_at() defined in 0002_create_languages.sql.
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_growth_levels_set_updated_at
  BEFORE UPDATE ON growth_levels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: check_growth_level_system_protection
-- Prevents accidental modification of system levels.
--
-- Blocked operations on rows where is_system_level = true:
--   1. Setting is_active = false
--   2. Setting deleted_at to a non-null value (soft delete)
--   3. Setting is_system_level = false (downgrading the guard itself)
--
-- This trigger fires BEFORE UPDATE OR DELETE so the check runs inside the
-- same transaction and rolls back cleanly.
--
-- Note on DELETE:
--   A hard DELETE on a system level is also blocked. This covers both
--   direct SQL and any application path that bypasses soft delete.
--
-- Override:
--   Only a super_admin applying a deliberate schema migration should ever
--   modify system levels. There is no runtime override path by design.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_growth_level_system_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Block hard DELETE on system levels
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system_level = true THEN
      RAISE EXCEPTION
        'Cannot delete system growth level "%" (code: %). '
        'System levels are protected. Only a schema migration may alter them.',
        OLD.name_en, OLD.code;
    END IF;
    RETURN OLD;
  END IF;

  -- Block UPDATE operations that would neutralise a system level
  IF TG_OP = 'UPDATE' AND OLD.is_system_level = true THEN

    -- Block deactivation
    IF NEW.is_active = false AND OLD.is_active = true THEN
      RAISE EXCEPTION
        'Cannot deactivate system growth level "%" (code: %). '
        'System levels must remain active.',
        OLD.name_en, OLD.code;
    END IF;

    -- Block soft delete
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      RAISE EXCEPTION
        'Cannot soft-delete system growth level "%" (code: %). '
        'System levels are protected from deletion.',
        OLD.name_en, OLD.code;
    END IF;

    -- Block downgrading the system flag itself
    IF NEW.is_system_level = false THEN
      RAISE EXCEPTION
        'Cannot remove system protection from growth level "%" (code: %). '
        'Use a schema migration to modify system level definitions.',
        OLD.name_en, OLD.code;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_growth_level_system_protection() IS
  'BEFORE UPDATE OR DELETE trigger on growth_levels. '
  'Raises EXCEPTION if any operation attempts to deactivate, soft-delete, '
  'or remove the is_system_level flag from a system growth level. '
  'Hard DELETE on system levels is also blocked. '
  'System levels may only be changed through deliberate schema migrations.';

CREATE TRIGGER trg_growth_levels_system_protection
  BEFORE UPDATE OR DELETE ON growth_levels
  FOR EACH ROW EXECUTE FUNCTION check_growth_level_system_protection();


-- -----------------------------------------------------------------------------
-- SEED DATA: four system growth levels
--
-- Level 1: Self Leadership    / 자기관리      / การนำตนเอง
-- Level 2: Coached            / 코칭 참여      / การรับการโค้ช
-- Level 3: Coach              / 코치           / โค้ช
-- Level 4: Coach Maker        / 코치 양성      / ผู้สร้างโค้ช
--
-- sort_order uses multiples of 10 so future non-system levels can be
-- inserted between system levels without renumbering existing rows.
--
-- ON CONFLICT (code) DO NOTHING makes this block idempotent:
--   - Safe to re-run the migration without errors or duplicate rows.
--   - Safe in environments where seed data was already inserted separately.
--
-- Note: conflict target uses the code column (natural stable key) rather
-- than id (which is generated and unknowable at seed time).
-- -----------------------------------------------------------------------------
INSERT INTO growth_levels (
  level_number,
  code,
  name_ko,
  name_en,
  name_th,
  description,
  is_system_level,
  is_active,
  sort_order
)
VALUES
  (
    1,
    'level_1',
    '자기관리',
    'Self Leadership',
    'การนำตนเอง',
    'The foundation level. The individual manages personal goals, '
    'tracks weekly progress, and develops self-discipline in spiritual '
    'and personal growth.',
    true,
    true,
    10
  ),
  (
    2,
    'level_2',
    '코칭 참여',
    'Coached',
    'การรับการโค้ช',
    'The individual is actively engaged in a coaching relationship, '
    'receiving feedback from a coach and growing through guided reflection.',
    true,
    true,
    20
  ),
  (
    3,
    'level_3',
    '코치',
    'Coach',
    'โค้ช',
    'The individual coaches others, providing feedback, asking questions, '
    'and supporting coachees in their growth journey.',
    true,
    true,
    30
  ),
  (
    4,
    'level_4',
    '코치 양성',
    'Coach Maker',
    'ผู้สร้างโค้ช',
    'The individual trains and develops coaches, multiplying the coaching '
    'capacity of the community and building the next generation of coaches.',
    true,
    true,
    40
  )
ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- End of 0004_create_growth_levels.sql
--
-- Objects created:
--   TABLE      growth_levels
--   CONSTRAINT uq_growth_levels_level_number       (unique)
--   CONSTRAINT uq_growth_levels_code               (unique)
--   INDEX      idx_growth_levels_is_active          (active + sort)
--   INDEX      idx_growth_levels_is_system          (system flag)
--   INDEX      idx_growth_levels_deleted_at         (soft delete)
--   TRIGGER    trg_growth_levels_set_updated_at     (updated_at)
--   FUNCTION   check_growth_level_system_protection()
--   TRIGGER    trg_growth_levels_system_protection  (DELETE + UPDATE guard)
--   ROWS       level_1, level_2, level_3, level_4   (4 seed rows)
--
-- Referenced by (future migrations):
--   profiles.growth_level_id               → growth_levels(id)
--   level_requirements.from_level_id       → growth_levels(id)
--   level_requirements.to_level_id         → growth_levels(id)
--   level_progress_reviews.current_level_id → growth_levels(id)
--   level_promotion_requests.current_level_id → growth_levels(id)
-- =============================================================================
