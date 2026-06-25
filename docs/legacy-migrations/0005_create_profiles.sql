-- =============================================================================
-- Migration: 0005_create_profiles.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the profiles table — the stable application identity
--            anchor for every user on the platform.
--
-- Identity model:
--   profiles.id          Stable permanent identity. Never changes, never deleted.
--                        All coaching records, goals, logs, and lineage data
--                        reference this id. Use this as the FK target everywhere.
--
--   profiles.auth_user_id Nullable link to auth.users(id). Represents the
--                        current active login session link. Cleared on
--                        anonymisation. ON DELETE SET NULL so deleting an
--                        auth account does not cascade into coaching history.
--
-- Why auth_user_id is nullable:
--   When a user requests account deletion or anonymisation, the system:
--     1. Wipes PII fields (full_name, display_name, email, phone)
--     2. Sets auth_user_id = null  (disconnects login)
--     3. Sets status = 'anonymized'
--     4. Sets anonymized_at = now()
--     5. Optionally sets deleted_at to hide from normal views
--   The profiles.id remains as a stable non-public reference for:
--     - weekly statistics and achievement history
--     - coaching relationship history
--     - coaching generation lineage
--     - organisation-level aggregated analytics
--   A partial unique index on auth_user_id WHERE NOT NULL enforces
--   one-to-one mapping for live accounts while allowing multiple nulls
--   (many anonymised profiles may exist with auth_user_id = null).
--
-- RLS note (policies created in a later migration):
--   - All user-owned data access must resolve auth.uid() to profiles.id
--     through profiles.auth_user_id.
--   - If auth_user_id is null, the profile must not be treated as an
--     authenticated user-owned profile.
--   - Anonymised profiles (status = 'anonymized') must not be accessible
--     as personal accounts.
--
-- Dependencies (must exist before this migration):
--   0000_create_extensions.sql  → gen_random_uuid()
--   0001_create_enums.sql       → profile_status_enum, system_role_enum
--   0002_create_languages.sql   → supported_languages(code), set_updated_at()
--   0003_create_geography.sql   → countries, regions, organizations,
--                                  churches, groups, cohorts
--   0004_create_growth_levels.sql → growth_levels(id)
-- =============================================================================


-- =============================================================================
-- TABLE: profiles
-- =============================================================================
CREATE TABLE profiles (

  -- ---------------------------------------------------------------------------
  -- Primary identity
  -- ---------------------------------------------------------------------------
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nullable FK to auth.users. ON DELETE SET NULL: deleting the auth account
  -- disconnects the login link without destroying coaching history.
  -- Unique partial index enforces one-to-one for live (non-null) accounts.
  auth_user_id          uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ---------------------------------------------------------------------------
  -- Personally identifiable information (PII)
  -- These fields are wiped / replaced during anonymisation.
  -- See anonymisation fields below and the erasure workflow in the spec.
  -- ---------------------------------------------------------------------------
  full_name             text          CHECK (full_name IS NULL OR length(trim(full_name)) > 0),
  display_name          text          CHECK (display_name IS NULL OR length(trim(display_name)) > 0),
  email                 text          CHECK (email IS NULL OR length(trim(email)) > 0),
  phone                 text          CHECK (phone IS NULL OR length(trim(phone)) > 0),

  -- ---------------------------------------------------------------------------
  -- Organisational scope
  -- All nullable: a profile may be unscoped during onboarding.
  -- ON DELETE SET NULL: geography restructuring does not block profiles.
  -- ---------------------------------------------------------------------------
  country_id            uuid          REFERENCES countries(id)      ON DELETE SET NULL,
  region_id             uuid          REFERENCES regions(id)        ON DELETE SET NULL,
  organization_id       uuid          REFERENCES organizations(id)  ON DELETE SET NULL,
  church_id             uuid          REFERENCES churches(id)       ON DELETE SET NULL,
  group_id              uuid          REFERENCES groups(id)         ON DELETE SET NULL,
  cohort_id             uuid          REFERENCES cohorts(id)        ON DELETE SET NULL,

  -- ---------------------------------------------------------------------------
  -- Role and level
  -- primary_role: nullable; used only for default dashboard routing.
  -- Authoritative role assignments live in user_roles (future migration).
  -- growth_level_id: nullable; set once the user is assigned a level.
  -- ---------------------------------------------------------------------------
  primary_role          system_role_enum,
  growth_level_id       uuid          REFERENCES growth_levels(id)  ON DELETE SET NULL,

  -- ---------------------------------------------------------------------------
  -- Coaching lineage — denormalised convenience fields
  -- Authoritative lineage data lives in coaching_generations.
  -- These fields allow fast profile-level display without a join.
  --
  -- generation_number: which generation this user is in (0 = founder).
  -- parent_coach_id:   direct coach in the generation tree (self-ref FK).
  --                    SET NULL if the coach's profile is anonymised.
  -- growth_level_updated_at: when the current growth_level_id last changed.
  -- promoted_by:       profiles.id of the admin/coach maker who approved
  --                    the most recent promotion (self-ref FK, nullable).
  -- ---------------------------------------------------------------------------
  generation_number     smallint,
  parent_coach_id       uuid          REFERENCES profiles(id)       ON DELETE SET NULL,
  growth_level_updated_at timestamptz,
  promoted_by           uuid          REFERENCES profiles(id)       ON DELETE SET NULL,

  -- ---------------------------------------------------------------------------
  -- Profile status
  -- Uses profile_status_enum: active | inactive | suspended | archived | anonymized
  -- Default is 'active' for newly created profiles.
  -- ---------------------------------------------------------------------------
  status                profile_status_enum NOT NULL DEFAULT 'active',

  -- ---------------------------------------------------------------------------
  -- Localisation preferences
  -- preferred_language: references supported_languages(code).
  --                     Nullable; falls back through org → country → English.
  -- timezone:           IANA timezone name (e.g. 'Asia/Seoul').
  --                     Nullable; falls back through org → country → UTC.
  -- ---------------------------------------------------------------------------
  preferred_language    text          REFERENCES supported_languages(code)
                                        ON UPDATE CASCADE ON DELETE SET NULL,
  timezone              text          CHECK (timezone IS NULL OR length(trim(timezone)) > 0),

  -- ---------------------------------------------------------------------------
  -- Anonymisation fields
  -- anonymized_at:        When PII was wiped and auth_user_id was cleared.
  -- anonymized_by:        profiles.id of the admin who triggered anonymisation.
  --                       Self-referencing FK; SET NULL if that admin's profile
  --                       is later anonymised.
  -- erasure_requested_at: When the user formally submitted their erasure request,
  --                       before processing began. Preserved even after anonymisation
  --                       for compliance audit purposes.
  -- ---------------------------------------------------------------------------
  anonymized_at         timestamptz,
  anonymized_by         uuid          REFERENCES profiles(id)       ON DELETE SET NULL,
  erasure_requested_at  timestamptz,

  -- ---------------------------------------------------------------------------
  -- Timestamps and soft delete
  -- ---------------------------------------------------------------------------
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  deleted_at            timestamptz,

  -- ---------------------------------------------------------------------------
  -- Table-level constraints
  -- ---------------------------------------------------------------------------

  -- Anonymisation consistency: if anonymized_at is set, status must be 'anonymized'
  CONSTRAINT chk_profiles_anonymized_status
    CHECK (
      anonymized_at IS NULL
      OR status = 'anonymized'
    ),

  -- Erasure request must precede or equal anonymisation
  CONSTRAINT chk_profiles_erasure_before_anonymization
    CHECK (
      erasure_requested_at IS NULL
      OR anonymized_at IS NULL
      OR erasure_requested_at <= anonymized_at
    ),

  -- When status = 'anonymized', auth_user_id must be null and anonymized_at
  -- must be set. Prevents an anonymised profile from remaining linked to an
  -- active auth account, and ensures the anonymisation timestamp is always
  -- recorded when the status is set.
  CONSTRAINT chk_profiles_anonymized_auth_disconnected
    CHECK (
      status <> 'anonymized'
      OR (
        auth_user_id IS NULL
        AND anonymized_at IS NOT NULL
      )
    ),

  -- generation_number must be zero or positive when present.
  -- 0 = founder / root leader; 1+ = subsequent generations.
  -- Negative values have no meaning in the coaching generation model.
  CONSTRAINT chk_profiles_generation_number_nonnegative
    CHECK (
      generation_number IS NULL OR generation_number >= 0
    )

);

-- TODO: Profile scope consistency (e.g. profiles.church_id must belong to
-- profiles.organization_id) will be validated in a later dedicated migration
-- after user_roles is created.

-- Table comment
COMMENT ON TABLE profiles IS
  'Stable application identity for every user on the platform. '
  'profiles.id is the permanent internal identity referenced by all coaching '
  'records, goals, logs, feedback, and lineage data. '
  'profiles.auth_user_id is the nullable login link — cleared on anonymisation '
  'while profiles.id is preserved for historical analytics. '
  'PII fields (full_name, display_name, email, phone) are wiped during '
  'the erasure/anonymisation workflow.';

-- Column comments
COMMENT ON COLUMN profiles.id IS
  'Stable permanent application identity. Never changes, never deleted. '
  'Used as the FK target in weekly_logs, goals, coaching_relationships, '
  'coaching_generations, coach_feedback, and user_roles.';

COMMENT ON COLUMN profiles.auth_user_id IS
  'Nullable FK to auth.users(id). Represents the current active login link. '
  'Cleared (set to null) during anonymisation. ON DELETE SET NULL ensures '
  'that deleting the auth account does not cascade into coaching history. '
  'A partial unique index enforces one-to-one mapping for live accounts '
  'while allowing multiple null values for anonymised profiles.';

COMMENT ON COLUMN profiles.full_name IS
  'Full legal or given name. PII — wiped to ''Deleted User'' on anonymisation.';

COMMENT ON COLUMN profiles.display_name IS
  'Preferred display name shown in the UI. PII — wiped on anonymisation.';

COMMENT ON COLUMN profiles.email IS
  'Email address. PII — wiped or replaced with anonymised placeholder on erasure.';

COMMENT ON COLUMN profiles.phone IS
  'Phone number. PII — wiped on anonymisation.';

COMMENT ON COLUMN profiles.primary_role IS
  'Nullable. Used only for default dashboard routing on login. '
  'Not the authoritative role source — use user_roles for permission checks.';

COMMENT ON COLUMN profiles.growth_level_id IS
  'Current growth level (Level 1–4). References growth_levels(id). '
  'Nullable until the user is formally assigned a level.';

COMMENT ON COLUMN profiles.generation_number IS
  'Denormalised generation number for fast display (0 = founder/root leader). '
  'Authoritative lineage data lives in coaching_generations.';

COMMENT ON COLUMN profiles.parent_coach_id IS
  'Denormalised direct coach in the generation tree. Self-referencing FK. '
  'SET NULL if the coach''s profile is anonymised. '
  'Authoritative parent relationship lives in coaching_generations.parent_id.';

COMMENT ON COLUMN profiles.growth_level_updated_at IS
  'Timestamp of the most recent growth_level_id change. '
  'Updated by the promotion approval workflow.';

COMMENT ON COLUMN profiles.promoted_by IS
  'profiles.id of the admin or coach maker who approved the most recent '
  'level promotion. Self-referencing FK; nullable.';

COMMENT ON COLUMN profiles.status IS
  'Profile lifecycle status. Uses profile_status_enum. '
  'active | inactive | suspended | archived | anonymized. '
  'Set to ''anonymized'' during the erasure workflow.';

COMMENT ON COLUMN profiles.preferred_language IS
  'User''s preferred UI language. References supported_languages(code). '
  'Nullable — falls back through cohort → group → church → org → country → English.';

COMMENT ON COLUMN profiles.timezone IS
  'IANA timezone name (e.g. Asia/Seoul, Asia/Bangkok, UTC). '
  'Nullable — falls back through org → country → UTC.';

COMMENT ON COLUMN profiles.anonymized_at IS
  'Timestamp when PII was wiped and auth_user_id was cleared. '
  'When set, status must be ''anonymized'' (enforced by constraint).';

COMMENT ON COLUMN profiles.anonymized_by IS
  'profiles.id of the admin who triggered the anonymisation workflow. '
  'Self-referencing FK; SET NULL if that admin''s profile is later anonymised.';

COMMENT ON COLUMN profiles.erasure_requested_at IS
  'Timestamp when the user formally submitted their right-to-erasure request. '
  'Preserved after anonymisation for compliance audit purposes.';

COMMENT ON COLUMN profiles.deleted_at IS
  'Soft-delete timestamp. Soft-deleted profiles are excluded from normal views '
  'but preserved for historical analytics and lineage tracking.';

COMMENT ON CONSTRAINT chk_profiles_anonymized_status ON profiles IS
  'If anonymized_at is set, status must be ''anonymized''. '
  'Prevents inconsistent state where PII is wiped but status still shows active.';

COMMENT ON CONSTRAINT chk_profiles_erasure_before_anonymization ON profiles IS
  'Erasure request timestamp must not be later than the anonymisation timestamp. '
  'Ensures the audit trail is chronologically consistent.';

COMMENT ON CONSTRAINT chk_profiles_anonymized_auth_disconnected ON profiles IS
  'When status = ''anonymized'', auth_user_id must be null and anonymized_at '
  'must be set. Prevents an anonymised profile from remaining linked to an '
  'active auth account, and ensures the anonymisation timestamp is always '
  'recorded when the status is changed to ''anonymized''.';

COMMENT ON CONSTRAINT chk_profiles_generation_number_nonnegative ON profiles IS
  'generation_number must be zero or positive when present. '
  '0 = founder / root leader; 1+ = subsequent coaching generations. '
  'Negative values have no meaning in the disciple multiplication model.';


-- =============================================================================
-- UNIQUE PARTIAL INDEX: auth_user_id
-- Enforces one-to-one mapping between auth.users and profiles for live
-- (non-anonymised) accounts, while allowing multiple null values for
-- anonymised profiles that have been disconnected from auth.
--
-- A plain UNIQUE constraint on auth_user_id would reject multiple NULLs in
-- most databases. A partial index with WHERE auth_user_id IS NOT NULL is the
-- correct pattern for nullable unique columns.
-- =============================================================================
CREATE UNIQUE INDEX uq_profiles_auth_user_id
  ON profiles (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON INDEX uq_profiles_auth_user_id IS
  'Enforces one-to-one mapping for live accounts (auth_user_id IS NOT NULL). '
  'Allows multiple NULL values for anonymised profiles.';


-- =============================================================================
-- INDEXES
-- Required by spec section 5 (Database Constraints and Indexes) plus
-- additional indexes for common query patterns on this table.
-- =============================================================================

-- Scope FK indexes — required by spec
CREATE INDEX idx_profiles_country_id
  ON profiles (country_id)
  WHERE deleted_at IS NULL AND country_id IS NOT NULL;

CREATE INDEX idx_profiles_region_id
  ON profiles (region_id)
  WHERE deleted_at IS NULL AND region_id IS NOT NULL;

CREATE INDEX idx_profiles_organization_id
  ON profiles (organization_id)
  WHERE deleted_at IS NULL AND organization_id IS NOT NULL;

CREATE INDEX idx_profiles_church_id
  ON profiles (church_id)
  WHERE deleted_at IS NULL AND church_id IS NOT NULL;

CREATE INDEX idx_profiles_group_id
  ON profiles (group_id)
  WHERE deleted_at IS NULL AND group_id IS NOT NULL;

CREATE INDEX idx_profiles_cohort_id
  ON profiles (cohort_id)
  WHERE deleted_at IS NULL AND cohort_id IS NOT NULL;

-- Growth level index — required by spec
CREATE INDEX idx_profiles_growth_level_id
  ON profiles (growth_level_id)
  WHERE deleted_at IS NULL AND growth_level_id IS NOT NULL;

-- Status index — common filter for active/inactive dashboard queries
CREATE INDEX idx_profiles_status
  ON profiles (status)
  WHERE deleted_at IS NULL;

-- Coaching lineage index — for tree traversal and promotion candidate queries
CREATE INDEX idx_profiles_parent_coach_id
  ON profiles (parent_coach_id)
  WHERE deleted_at IS NULL AND parent_coach_id IS NOT NULL;

-- Soft delete index — required by spec
CREATE INDEX idx_profiles_deleted_at
  ON profiles (deleted_at);


-- =============================================================================
-- TRIGGER: updated_at
-- Reuses set_updated_at() defined in 0002_create_languages.sql.
-- =============================================================================
CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- End of 0005_create_profiles.sql
--
-- Objects created:
--   TABLE      profiles
--   INDEX      uq_profiles_auth_user_id         (unique partial, auth_user_id)
--   INDEX      idx_profiles_country_id           (scope, partial)
--   INDEX      idx_profiles_region_id            (scope, partial)
--   INDEX      idx_profiles_organization_id      (scope, partial)
--   INDEX      idx_profiles_church_id            (scope, partial)
--   INDEX      idx_profiles_group_id             (scope, partial)
--   INDEX      idx_profiles_cohort_id            (scope, partial)
--   INDEX      idx_profiles_growth_level_id      (level, partial)
--   INDEX      idx_profiles_status               (status, partial)
--   INDEX      idx_profiles_parent_coach_id      (lineage, partial)
--   INDEX      idx_profiles_deleted_at           (soft delete)
--   TRIGGER    trg_profiles_set_updated_at       (updated_at)
--
-- Key design decisions:
--   - profiles.id is the stable permanent identity (never deleted)
--   - profiles.auth_user_id is nullable (cleared on anonymisation)
--   - Unique partial index on auth_user_id WHERE NOT NULL
--   - All scope FKs use ON DELETE SET NULL
--   - parent_coach_id and promoted_by are self-referencing FKs
--   - Four table-level CHECK constraints:
--       chk_profiles_anonymized_status
--       chk_profiles_erasure_before_anonymization
--       chk_profiles_anonymized_auth_disconnected
--       chk_profiles_generation_number_nonnegative
--   - TODO: profile scope consistency deferred (see comment after CREATE TABLE)
--   - RLS policies to be added in a later dedicated RLS migration
--
-- Referenced by (future migrations):
--   goals.user_id                        → profiles(id)
--   weekly_logs.user_id                  → profiles(id)
--   coaching_relationships.coach_id      → profiles(id)
--   coaching_relationships.coachee_id    → profiles(id)
--   coaching_generations.user_id         → profiles(id)
--   coach_feedback.coach_id              → profiles(id)
--   user_roles.user_id                   → profiles(id)
--   invitations.invited_by               → profiles(id)
-- =============================================================================
