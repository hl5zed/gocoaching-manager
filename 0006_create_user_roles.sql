-- =============================================================================
-- Migration: 0006_create_user_roles.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the user_roles table — the authoritative source for all
--            role assignments and scope-based access control on the platform.
--
-- Design overview:
--   A user (profile) may hold multiple system roles simultaneously.
--   Each role is scoped to a specific level of the hierarchy
--   (global, country, region, organization, church, group, cohort, coach).
--   RLS helper functions (created in a later migration) will query this table
--   to determine what data a user may read or modify.
--
-- Naming note:
--   The spec uses 'user_id' and 'assigned_by' / 'assigned_at'.
--   This migration uses 'profile_id', 'granted_by', and 'granted_at'
--   per the stated requirements, to make the FK target (profiles.id)
--   unambiguous and consistent with the identity model from 0005.
--
-- scope_id nullability:
--   scope_type = 'global'  → scope_id must be NULL  (no entity to reference)
--   scope_type != 'global' → scope_id must NOT NULL  (references a specific entity)
--   Enforced by: chk_user_roles_scope_id_global (CHECK constraint)
--   Enforced by: trg_user_roles_validate_scope  (trigger — verifies entity exists)
--
-- is_active / status relationship:
--   status (user_role_status_enum) carries lifecycle granularity:
--     active | inactive | revoked
--   is_active (boolean) is a fast-path flag used in partial indexes and
--   RLS helpers. Application layer must keep is_active = (status = 'active').
--
-- Dependencies:
--   0001_create_enums.sql       → system_role_enum, scope_type_enum,
--                                  user_role_status_enum
--   0003_create_geography.sql   → countries, regions, organizations,
--                                  churches, groups, cohorts
--   0004_create_growth_levels.sql (indirect — no direct FK)
--   0005_create_profiles.sql    → profiles(id)
-- =============================================================================


-- =============================================================================
-- TABLE: user_roles
-- =============================================================================
CREATE TABLE user_roles (

  id           uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Profile this role is assigned to. CASCADE: if a profile is hard-deleted
  -- (super_admin only), its role assignments go with it.
  profile_id   uuid                  NOT NULL
                 REFERENCES profiles(id) ON DELETE CASCADE,

  -- The system role being granted.
  role         system_role_enum      NOT NULL,

  -- The hierarchy level this role applies to.
  scope_type   scope_type_enum       NOT NULL,

  -- The specific entity this role applies to.
  -- NULL only when scope_type = 'global' (enforced by constraint + trigger).
  scope_id     uuid,

  -- Who granted this role. SET NULL if the granting admin's profile is deleted.
  granted_by   uuid
                 REFERENCES profiles(id) ON DELETE SET NULL,

  -- When the role was formally granted.
  granted_at   timestamptz           NOT NULL DEFAULT now(),

  -- Optional expiry. Application layer sets status = 'inactive' when expired.
  -- No automatic DB-level expiry enforcement — handled by scheduled job.
  expires_at   timestamptz,

  -- ---------------------------------------------------------------------------
  -- Role Status Update Rule:
  --   Whenever status changes:
  --   - status = 'active'  means is_active must be true.
  --   - status <> 'active' means is_active must be false.
  --   Application code must update both fields together in the same statement.
  --   The DB constraint (chk_user_roles_is_active_consistent) enforces this
  --   consistency and will reject any row where the two fields disagree.
  -- ---------------------------------------------------------------------------

  -- Lifecycle status with granularity (active | inactive | revoked).
  status       user_role_status_enum NOT NULL DEFAULT 'active',

  -- Fast-path boolean flag for partial indexes and RLS helper functions.
  -- True when status = 'active', false otherwise.
  is_active    boolean               NOT NULL DEFAULT true,

  -- Timestamps and soft delete
  created_at   timestamptz           NOT NULL DEFAULT now(),
  updated_at   timestamptz           NOT NULL DEFAULT now(),
  deleted_at   timestamptz,

  -- -------------------------------------------------------------------------
  -- Table-level constraints
  -- -------------------------------------------------------------------------

  -- scope_id must be null for global scope, non-null for all other scopes.
  CONSTRAINT chk_user_roles_scope_id_global
    CHECK (
      (scope_type = 'global' AND scope_id IS NULL)
      OR
      (scope_type <> 'global' AND scope_id IS NOT NULL)
    ),

  -- expires_at must be in the future relative to granted_at when set.
  CONSTRAINT chk_user_roles_expires_after_granted
    CHECK (
      expires_at IS NULL
      OR expires_at > granted_at
    ),

  -- is_active and status must not contradict each other.
  -- active status → is_active must be true.
  -- non-active status → is_active must be false.
  CONSTRAINT chk_user_roles_is_active_consistent
    CHECK (
      (status = 'active'  AND is_active = true)
      OR
      (status <> 'active' AND is_active = false)
    )

);

COMMENT ON TABLE user_roles IS
  'Authoritative source for all role assignments on the platform. '
  'A profile may hold multiple roles simultaneously at different scope levels. '
  'RLS helper functions resolve permissions by querying this table. '
  'profiles.primary_role is used only for dashboard routing — '
  'user_roles is the source of truth for access control.';

COMMENT ON COLUMN user_roles.profile_id IS
  'The profile this role is assigned to. References profiles(id). '
  'ON DELETE CASCADE: if a profile is hard-deleted, its role assignments '
  'are removed. Soft-deleted profiles retain their role rows (deleted_at only).';

COMMENT ON COLUMN user_roles.role IS
  'The system role granted. One of system_role_enum values: '
  'super_admin, country_admin, organization_admin, church_admin, '
  'group_leader, coach_maker, coach, coachee.';

COMMENT ON COLUMN user_roles.scope_type IS
  'The hierarchy level this role applies to. '
  'Determines which table scope_id references (see trigger).';

COMMENT ON COLUMN user_roles.scope_id IS
  'The specific entity this role applies to. '
  'NULL only when scope_type = ''global''. '
  'For scope_type = ''coach'', references profiles(id) of the coach. '
  'Validated by trg_user_roles_validate_scope trigger.';

COMMENT ON COLUMN user_roles.granted_by IS
  'profiles.id of the admin who granted this role. '
  'SET NULL if the granting admin''s profile is later deleted.';

COMMENT ON COLUMN user_roles.granted_at IS
  'Timestamp when the role was formally granted. Defaults to now().';

COMMENT ON COLUMN user_roles.expires_at IS
  'Optional expiry timestamp for time-limited role grants. '
  'Application layer or scheduled job sets status = ''inactive'' / '
  'is_active = false when this timestamp is reached.';

COMMENT ON COLUMN user_roles.status IS
  'Lifecycle status of the role assignment. '
  'active = role is in effect. '
  'inactive = temporarily paused (can be reactivated). '
  'revoked = permanently withdrawn (cannot be reactivated without a new grant).';

COMMENT ON COLUMN user_roles.is_active IS
  'Fast-path boolean flag. True when status = ''active''. '
  'Used in partial unique indexes and RLS helper function queries. '
  'Must be kept consistent with status by the application layer. '
  'Enforced at the DB level by chk_user_roles_is_active_consistent.';

COMMENT ON CONSTRAINT chk_user_roles_scope_id_global ON user_roles IS
  'Enforces the scope_id nullability rule: '
  'scope_type = ''global'' requires scope_id IS NULL; '
  'all other scope_types require scope_id IS NOT NULL.';

COMMENT ON CONSTRAINT chk_user_roles_expires_after_granted ON user_roles IS
  'When expires_at is set, it must be later than granted_at. '
  'Prevents logically invalid time-limited grants.';

COMMENT ON CONSTRAINT chk_user_roles_is_active_consistent ON user_roles IS
  'Keeps is_active consistent with status. '
  'Prevents a role from showing is_active = true while status = ''revoked''.';


-- =============================================================================
-- PARTIAL UNIQUE INDEXES: active role deduplication
--
-- Goal: prevent duplicate active role grants for the same
-- (profile_id, role, scope_type, scope_id) combination.
--
-- Problem: scope_id is NULL for global roles. PostgreSQL treats two NULLs
-- as not-equal in a unique index, so a single index would allow duplicate
-- global roles. Solution: two complementary partial indexes.
--
--   Index A — non-global scopes (scope_id IS NOT NULL):
--     Standard four-column uniqueness.
--
--   Index B — global scope (scope_id IS NULL):
--     Three-column uniqueness (scope_id excluded because it is always NULL
--     for global and the IS NULL condition is enforced by the CHECK constraint).
--
-- Both indexes filter to: status = 'active' AND is_active = true
--                          AND deleted_at IS NULL
-- =============================================================================

-- Index A: unique active role per (profile, role, scope_type, scope_id)
-- for all non-global scopes
CREATE UNIQUE INDEX uq_user_roles_active_scoped
  ON user_roles (profile_id, role, scope_type, scope_id)
  WHERE status = 'active'
    AND is_active = true
    AND deleted_at IS NULL
    AND scope_id IS NOT NULL;

COMMENT ON INDEX uq_user_roles_active_scoped IS
  'Prevents duplicate active role grants for non-global scopes. '
  'Covers: status = ''active'', is_active = true, deleted_at IS NULL, '
  'scope_id IS NOT NULL.';

-- Index B: unique active role per (profile, role, scope_type)
-- for global scope only (scope_id is always null here)
CREATE UNIQUE INDEX uq_user_roles_active_global
  ON user_roles (profile_id, role, scope_type)
  WHERE status = 'active'
    AND is_active = true
    AND deleted_at IS NULL
    AND scope_id IS NULL;

COMMENT ON INDEX uq_user_roles_active_global IS
  'Prevents duplicate active global role grants. '
  'Covers: status = ''active'', is_active = true, deleted_at IS NULL, '
  'scope_id IS NULL (global scope only).';


-- =============================================================================
-- REGULAR INDEXES
-- Required by spec section 5 plus additional indexes for common query patterns.
-- =============================================================================

-- profile_id — required by spec; primary lookup for "what roles does this user have"
CREATE INDEX idx_user_roles_profile_id
  ON user_roles (profile_id)
  WHERE deleted_at IS NULL;

-- role + scope composite — required by spec; "who has role X in scope Y"
CREATE INDEX idx_user_roles_role_scope
  ON user_roles (role, scope_type, scope_id)
  WHERE deleted_at IS NULL AND is_active = true;

-- status — required by spec
CREATE INDEX idx_user_roles_status
  ON user_roles (status)
  WHERE deleted_at IS NULL;

-- granted_by — who granted roles (for audit and admin views)
CREATE INDEX idx_user_roles_granted_by
  ON user_roles (granted_by)
  WHERE deleted_at IS NULL AND granted_by IS NOT NULL;

-- expires_at — for scheduled expiry job queries
CREATE INDEX idx_user_roles_expires_at
  ON user_roles (expires_at)
  WHERE deleted_at IS NULL
    AND is_active = true
    AND expires_at IS NOT NULL;

-- deleted_at — soft delete filter
CREATE INDEX idx_user_roles_deleted_at
  ON user_roles (deleted_at);


-- =============================================================================
-- TRIGGER FUNCTION: validate_user_role_scope
--
-- Purpose:
--   Verify that scope_id references a real, non-soft-deleted record in the
--   correct table for the given scope_type.
--
-- Scope routing:
--   global       → skip (scope_id is null; enforced by CHECK constraint)
--   country      → countries(id)       WHERE deleted_at IS NULL
--   region       → regions(id)         WHERE deleted_at IS NULL
--   organization → organizations(id)   WHERE deleted_at IS NULL
--   church       → churches(id)        WHERE deleted_at IS NULL
--   group        → groups(id)          WHERE deleted_at IS NULL
--   cohort       → cohorts(id)         WHERE deleted_at IS NULL
--   coach        → profiles(id)        WHERE deleted_at IS NULL
--                  (coach scope references the coach's profile directly)
--
-- Fires: BEFORE INSERT OR UPDATE
-- Effect: EXCEPTION if the scope entity does not exist or is soft-deleted.
-- =============================================================================
CREATE OR REPLACE FUNCTION validate_user_role_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  scope_exists boolean := false;
BEGIN
  -- Global scope: scope_id must be null (already enforced by CHECK constraint).
  -- No table lookup required.
  IF NEW.scope_type = 'global' THEN
    RETURN NEW;
  END IF;

  -- For all other scope types, scope_id must reference an existing,
  -- non-soft-deleted row in the corresponding table.
  IF NEW.scope_type = 'country' THEN
    SELECT EXISTS (
      SELECT 1 FROM countries
       WHERE id = NEW.scope_id AND deleted_at IS NULL
    ) INTO scope_exists;

  ELSIF NEW.scope_type = 'region' THEN
    SELECT EXISTS (
      SELECT 1 FROM regions
       WHERE id = NEW.scope_id AND deleted_at IS NULL
    ) INTO scope_exists;

  ELSIF NEW.scope_type = 'organization' THEN
    SELECT EXISTS (
      SELECT 1 FROM organizations
       WHERE id = NEW.scope_id AND deleted_at IS NULL
    ) INTO scope_exists;

  ELSIF NEW.scope_type = 'church' THEN
    SELECT EXISTS (
      SELECT 1 FROM churches
       WHERE id = NEW.scope_id AND deleted_at IS NULL
    ) INTO scope_exists;

  ELSIF NEW.scope_type = 'group' THEN
    SELECT EXISTS (
      SELECT 1 FROM groups
       WHERE id = NEW.scope_id AND deleted_at IS NULL
    ) INTO scope_exists;

  ELSIF NEW.scope_type = 'cohort' THEN
    SELECT EXISTS (
      SELECT 1 FROM cohorts
       WHERE id = NEW.scope_id AND deleted_at IS NULL
    ) INTO scope_exists;

  ELSIF NEW.scope_type = 'coach' THEN
    -- Coach scope references the coach's own profile.
    -- Spec: scope_type = 'coach', scope_id = coach_user_id (a profiles.id).
    SELECT EXISTS (
      SELECT 1 FROM profiles
       WHERE id = NEW.scope_id AND deleted_at IS NULL
    ) INTO scope_exists;

  ELSE
    -- Unknown scope_type value — should not be reachable given the enum
    -- constraint, but guard defensively.
    RAISE EXCEPTION
      'Unknown scope_type ''%'' in user_roles. '
      'Cannot validate scope_id.',
      NEW.scope_type;
  END IF;

  IF NOT scope_exists THEN
    RAISE EXCEPTION
      'user_roles: scope_id % does not reference an active record '
      'in the expected table for scope_type ''%''. '
      'The record may not exist or may be soft-deleted.',
      NEW.scope_id, NEW.scope_type;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_user_role_scope() IS
  'BEFORE INSERT OR UPDATE trigger on user_roles. '
  'Verifies that scope_id references an existing, non-soft-deleted row '
  'in the correct table for the given scope_type: '
  'country → countries, region → regions, organization → organizations, '
  'church → churches, group → groups, cohort → cohorts, coach → profiles. '
  'global scope skips validation (scope_id is null). '
  'Raises EXCEPTION if the referenced entity does not exist or is soft-deleted.';

CREATE TRIGGER trg_user_roles_validate_scope
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION validate_user_role_scope();


-- =============================================================================
-- TRIGGER: updated_at
-- Reuses set_updated_at() defined in 0002_create_languages.sql.
-- =============================================================================
CREATE TRIGGER trg_user_roles_set_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TODO: deactivate_roles_on_scope_soft_delete triggers
--
-- In a later migration, add AFTER UPDATE triggers on each geography table
-- (countries, regions, organizations, churches, groups, cohorts) and on
-- profiles (for coach scope).
--
-- When a scoped entity is soft-deleted (deleted_at set to non-null), all
-- related active user_roles rows scoped to that entity should be set to:
--   status    = 'inactive'
--   is_active = false
--
-- This prevents roles from remaining nominally active against a scope that
-- no longer exists in normal views, while preserving the role history for
-- audit and potential restoration.
--
-- Do not create invitations yet.
-- =============================================================================


-- =============================================================================
-- End of 0006_create_user_roles.sql
--
-- Objects created:
--   TABLE      user_roles
--   CONSTRAINT chk_user_roles_scope_id_global          (scope nullability)
--   CONSTRAINT chk_user_roles_expires_after_granted    (temporal validity)
--   CONSTRAINT chk_user_roles_is_active_consistent     (flag/status sync)
--   INDEX      uq_user_roles_active_scoped             (unique partial, non-global)
--   INDEX      uq_user_roles_active_global             (unique partial, global)
--   INDEX      idx_user_roles_profile_id               (lookup)
--   INDEX      idx_user_roles_role_scope               (role + scope lookup)
--   INDEX      idx_user_roles_status                   (status filter)
--   INDEX      idx_user_roles_granted_by               (audit)
--   INDEX      idx_user_roles_expires_at               (expiry job)
--   INDEX      idx_user_roles_deleted_at               (soft delete)
--   FUNCTION   validate_user_role_scope()              (scope existence check)
--   TRIGGER    trg_user_roles_validate_scope           (BEFORE INSERT OR UPDATE)
--   TRIGGER    trg_user_roles_set_updated_at           (updated_at)
--
-- Key design decisions:
--   - profile_id (not user_id) — matches profiles.id identity model
--   - granted_by / granted_at (not assigned_by / assigned_at)
--   - Two partial unique indexes handle the NULL scope_id edge case
--   - is_active kept consistent with status via CHECK constraint
--   - Scope trigger validates all 7 non-global scope types
--   - No invitations table created (deferred to next migration)
--
-- Referenced by (future migrations):
--   RLS helper functions: is_super_admin(), has_role(), has_scope_access()
--   invitations: on acceptance, creates a user_roles record
-- =============================================================================
