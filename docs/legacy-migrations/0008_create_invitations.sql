-- =============================================================================
-- Migration: 0008_create_invitations.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the invitations table — the mechanism for bringing new
--            users onto the platform within a scoped role assignment.
--
-- Token security model:
--   The raw invitation token is a credential and must NEVER be stored in the
--   database. An attacker with read access to the DB (compromised backup,
--   misconfigured RLS, etc.) must not be able to extract and use valid tokens.
--
--   Correct flow:
--     1. Application generates a cryptographically random raw token.
--     2. Application hashes the raw token (e.g. SHA-256).
--     3. Only the hash is written to token_hash (this column).
--     4. The raw token is sent to the user once via email — never stored.
--     5. When the user clicks the link, the application hashes the presented
--        token and looks up: WHERE token_hash = hash(presented_token)
--                             AND status = 'pending'
--                             AND expires_at > now()
--
--   token_hash has a UNIQUE constraint — equivalent to spec's unique(token).
--
-- Acceptance flow (handled by application / Edge Function, not this file):
--   1. Validate: token hash matches, status = 'pending', not expired.
--   2. Create or connect a profiles record for the accepting user.
--   3. Create a user_roles record for (profile_id, invited_role, scope).
--   4. Set: status = 'accepted', accepted_at = now(), accepted_by = profile_id.
--   5. Write audit log entries for the invitation acceptance and role grant.
--
-- Scope rules:
--   scope_type = 'global'  → scope_id must be NULL
--   scope_type != 'global' → scope_id must NOT NULL
--   Enforced by: chk_invitations_scope_id_global (CHECK constraint)
--   Enforced by: trg_invitations_validate_scope  (trigger — entity existence)
--
-- Dependencies:
--   0000_create_extensions.sql    → gen_random_uuid()
--   0001_create_enums.sql         → system_role_enum, scope_type_enum,
--                                    invitation_status_enum
--   0003_create_geography.sql     → countries, regions, organizations,
--                                    churches, groups, cohorts
--   0005_create_profiles.sql      → profiles(id)
--   0002_create_languages.sql     → set_updated_at()
-- =============================================================================


-- =============================================================================
-- TABLE: invitations
-- =============================================================================
CREATE TABLE invitations (

  id             uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email address the invitation was sent to.
  -- Named invited_email (not email) to distinguish from the accepting user's
  -- current account email, which may differ.
  invited_email  text                    NOT NULL
                   CHECK (length(trim(invited_email)) > 0),

  -- The system role that will be granted when this invitation is accepted.
  invited_role   system_role_enum        NOT NULL,

  -- The scope level at which the role will be granted.
  scope_type     scope_type_enum         NOT NULL,

  -- The specific entity the role applies to.
  -- NULL only when scope_type = 'global' (enforced by constraint + trigger).
  scope_id       uuid,

  -- The profile that created and sent this invitation.
  -- Admins may only invite within their own scope (enforced at application layer).
  -- SET NULL if the inviting admin's profile is hard-deleted.
  invited_by     uuid                    REFERENCES profiles(id) ON DELETE SET NULL,

  -- ---------------------------------------------------------------------------
  -- Token security
  -- The raw token is sent to the user via email and NEVER stored here.
  -- Only the hash of the raw token is stored.
  -- Lookup: WHERE token_hash = hash(presented_token) AND status = 'pending'
  --         AND expires_at > now()
  -- ---------------------------------------------------------------------------
  token_hash     text                    NOT NULL,

  -- Lifecycle status of this invitation.
  status         invitation_status_enum  NOT NULL DEFAULT 'pending',

  -- When this invitation stops being valid for acceptance.
  -- Application should set a short window (e.g. 72 hours from created_at).
  expires_at     timestamptz             NOT NULL,

  -- When the invitation was accepted. Set by the acceptance flow.
  accepted_at    timestamptz,

  -- The profile that accepted the invitation.
  -- May differ from the invited_email owner in edge cases.
  -- SET NULL if the accepting profile is later hard-deleted.
  accepted_by    uuid                    REFERENCES profiles(id) ON DELETE SET NULL,

  -- Timestamps and soft delete.
  -- Soft delete is rarely needed (invitations reach terminal states:
  -- accepted / expired / revoked) but is included for error correction.
  created_at     timestamptz             NOT NULL DEFAULT now(),
  updated_at     timestamptz             NOT NULL DEFAULT now(),
  deleted_at     timestamptz,

  -- ---------------------------------------------------------------------------
  -- Table-level constraints
  -- ---------------------------------------------------------------------------

  -- scope_id nullability rule (mirrors user_roles pattern).
  CONSTRAINT chk_invitations_scope_id_global
    CHECK (
      (scope_type = 'global' AND scope_id IS NULL)
      OR
      (scope_type <> 'global' AND scope_id IS NOT NULL)
    ),

  -- expires_at must be after created_at.
  CONSTRAINT chk_invitations_expires_after_created
    CHECK (expires_at > created_at),

  -- Acceptance state consistency (bidirectional):
  -- When status = 'accepted': accepted_at and accepted_by must both be set.
  -- When status != 'accepted': accepted_at and accepted_by must both be null.
  -- This prevents both partial acceptance state (fields missing on accepted rows)
  -- and spurious acceptance fields on pending/expired/revoked rows.
  CONSTRAINT chk_invitations_acceptance_state_consistent
    CHECK (
      (
        status = 'accepted'
        AND accepted_at IS NOT NULL
        AND accepted_by IS NOT NULL
      )
      OR
      (
        status <> 'accepted'
        AND accepted_at IS NULL
        AND accepted_by IS NULL
      )
    ),

  -- accepted_at must not precede created_at.
  CONSTRAINT chk_invitations_accepted_after_created
    CHECK (
      accepted_at IS NULL
      OR accepted_at >= created_at
    )

);

-- Table comment
COMMENT ON TABLE invitations IS
  'Invitation records for bringing new users onto the platform. '
  'Each invitation grants a specific role within a specific scope on acceptance. '
  'SECURITY: The raw invitation token is sent to the user by email and never '
  'stored here. Only token_hash is stored. Acceptance flow: validate hash + '
  'status + expiry → create/connect profile → create user_roles record → '
  'set status = ''accepted''. All invitation actions should create audit logs.';

-- Column comments
COMMENT ON COLUMN invitations.invited_email IS
  'Email address this invitation was sent to. '
  'Named invited_email (not email) to avoid ambiguity with the accepting '
  'user''s current account email, which may differ at acceptance time. '
  'Application code must normalize invited_email using lower(trim(email)) '
  'before insert. The pending-deduplication indexes use lower(invited_email) '
  'for case-insensitive uniqueness — storing a mixed-case value would bypass '
  'duplicate detection and cause confusing constraint errors at query time.';

COMMENT ON COLUMN invitations.invited_role IS
  'The system role that will be granted when this invitation is accepted. '
  'Combined with scope_type and scope_id to form the user_roles record.';

COMMENT ON COLUMN invitations.scope_type IS
  'The hierarchy level the granted role applies to. '
  'Mirrors the scope_type pattern from user_roles.';

COMMENT ON COLUMN invitations.scope_id IS
  'The specific entity the role applies to. '
  'NULL only when scope_type = ''global''. '
  'Validated by trg_invitations_validate_scope.';

COMMENT ON COLUMN invitations.invited_by IS
  'profiles.id of the admin who created this invitation. '
  'Admins may only invite within their own permitted scope — '
  'enforced at the application / Edge Function layer, not here. '
  'SET NULL if the inviting admin''s profile is hard-deleted.';

COMMENT ON COLUMN invitations.token_hash IS
  'Cryptographic hash of the raw invitation token. '
  'The raw token is generated by the application, sent to the user once '
  'via email, and NEVER stored in the database. '
  'Only this hash is stored. '
  'Lookup pattern: WHERE token_hash = hash(presented_token) '
  '                AND status = ''pending'' '
  '                AND expires_at > now() '
  'Unique constraint prevents hash collisions from creating duplicate lookups.';

COMMENT ON COLUMN invitations.status IS
  'Lifecycle status of the invitation. '
  'pending  → sent, awaiting acceptance. '
  'accepted → accepted by a user; profile and user_role created. '
  'expired  → expires_at passed without acceptance. '
  'revoked  → manually cancelled by an admin before acceptance.';

COMMENT ON COLUMN invitations.expires_at IS
  'Timestamp after which this invitation can no longer be accepted. '
  'Application should use a short window (e.g. 72 hours). '
  'Must be after created_at (enforced by constraint).';

COMMENT ON COLUMN invitations.accepted_at IS
  'Timestamp when the invitation was accepted. '
  'Must be set when status = ''accepted'' (enforced by constraint).';

COMMENT ON COLUMN invitations.accepted_by IS
  'profiles.id of the user who accepted the invitation. '
  'Must be set when status = ''accepted'' (enforced by constraint). '
  'May differ from the invited_email owner if accepted with a different account. '
  'SET NULL if that profile is later hard-deleted.';

COMMENT ON CONSTRAINT chk_invitations_scope_id_global ON invitations IS
  'Mirrors the scope_id rule from user_roles: '
  'scope_type = ''global'' requires scope_id IS NULL; '
  'all other scope_types require scope_id IS NOT NULL.';

COMMENT ON CONSTRAINT chk_invitations_expires_after_created ON invitations IS
  'Prevents logically invalid invitations where expiry precedes creation.';

COMMENT ON CONSTRAINT chk_invitations_acceptance_state_consistent ON invitations IS
  'Bidirectional acceptance state rule: '
  'When status = ''accepted'': accepted_at and accepted_by must both be set. '
  'When status != ''accepted'': accepted_at and accepted_by must both be null. '
  'Prevents both missing audit fields on accepted rows and spurious '
  'acceptance data on pending, expired, or revoked rows.';

COMMENT ON CONSTRAINT chk_invitations_accepted_after_created ON invitations IS
  'accepted_at must not be earlier than created_at. '
  'Ensures the acceptance timestamp is chronologically valid.';


-- =============================================================================
-- UNIQUE CONSTRAINTS
-- =============================================================================

-- token_hash must be globally unique — satisfies spec's unique(token).
ALTER TABLE invitations
  ADD CONSTRAINT uq_invitations_token_hash UNIQUE (token_hash);


-- =============================================================================
-- PARTIAL UNIQUE INDEXES: prevent duplicate pending invitations
--
-- Goal: prevent sending two pending invitations to the same email address
-- for the same role at the same scope simultaneously.
-- Once accepted, expired, or revoked, a new invitation may be issued.
--
-- Same NULL scope_id problem as user_roles:
--   Index A — non-global scopes (scope_id IS NOT NULL): four-column uniqueness.
--   Index B — global scope (scope_id IS NULL): three-column uniqueness.
-- =============================================================================

-- Index A: unique pending invitation per (email, role, scope_type, scope_id)
-- for all non-global scopes.
-- lower(invited_email) ensures case-insensitive deduplication:
-- 'User@example.com' and 'user@example.com' are treated as the same address.
CREATE UNIQUE INDEX uq_invitations_pending_scoped
  ON invitations (lower(invited_email), invited_role, scope_type, scope_id)
  WHERE status = 'pending'
    AND deleted_at IS NULL
    AND scope_id IS NOT NULL;

COMMENT ON INDEX uq_invitations_pending_scoped IS
  'Prevents duplicate pending invitations for non-global scopes. '
  'Uses lower(invited_email) for case-insensitive deduplication. '
  'Application code must normalise invited_email using lower(trim(email)) before insert. '
  'Once an invitation reaches a terminal status, a new one may be issued.';

-- Index B: unique pending invitation per (email, role, scope_type)
-- for global scope (scope_id always null here).
-- lower(invited_email) ensures case-insensitive deduplication.
CREATE UNIQUE INDEX uq_invitations_pending_global
  ON invitations (lower(invited_email), invited_role, scope_type)
  WHERE status = 'pending'
    AND deleted_at IS NULL
    AND scope_id IS NULL;

COMMENT ON INDEX uq_invitations_pending_global IS
  'Prevents duplicate pending global-scope invitations. '
  'Uses lower(invited_email) for case-insensitive deduplication. '
  'Application code must normalise invited_email using lower(trim(email)) before insert. '
  'Covers: status = ''pending'', deleted_at IS NULL, scope_id IS NULL.';


-- =============================================================================
-- REGULAR INDEXES
-- Required by spec section 5 plus additional indexes for common query patterns.
-- =============================================================================

-- token_hash — primary lookup path for invitation acceptance
-- (unique constraint above creates this index automatically, documented here)

-- invited_email — "show all invitations sent to this address"
CREATE INDEX idx_invitations_invited_email
  ON invitations (invited_email)
  WHERE deleted_at IS NULL;

-- status — "show all pending / expired invitations"
CREATE INDEX idx_invitations_status
  ON invitations (status)
  WHERE deleted_at IS NULL;

-- (scope_type, scope_id) — "show all invitations for this scope entity"
CREATE INDEX idx_invitations_scope
  ON invitations (scope_type, scope_id)
  WHERE deleted_at IS NULL AND scope_id IS NOT NULL;

-- expires_at — for scheduled expiry job: find pending invitations past expiry
CREATE INDEX idx_invitations_expires_at
  ON invitations (expires_at)
  WHERE status = 'pending'
    AND deleted_at IS NULL;

-- invited_by — "show all invitations issued by this admin"
CREATE INDEX idx_invitations_invited_by
  ON invitations (invited_by)
  WHERE deleted_at IS NULL AND invited_by IS NOT NULL;

-- deleted_at — soft delete filter
CREATE INDEX idx_invitations_deleted_at
  ON invitations (deleted_at);


-- =============================================================================
-- TRIGGER FUNCTION: validate_invitation_scope
--
-- Same pattern as validate_user_role_scope() from 0006_create_user_roles.sql.
-- Verifies that scope_id references an existing, non-soft-deleted row in the
-- correct table for the given scope_type.
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
--
-- Fires: BEFORE INSERT OR UPDATE
-- Effect: EXCEPTION if scope entity does not exist or is soft-deleted.
-- =============================================================================
CREATE OR REPLACE FUNCTION validate_invitation_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  scope_exists boolean := false;
BEGIN
  -- Global scope: scope_id must be null (enforced by CHECK constraint).
  IF NEW.scope_type = 'global' THEN
    RETURN NEW;
  END IF;

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
    SELECT EXISTS (
      SELECT 1 FROM profiles
       WHERE id = NEW.scope_id AND deleted_at IS NULL
    ) INTO scope_exists;

  ELSE
    RAISE EXCEPTION
      'Unknown scope_type ''%'' in invitations. '
      'Cannot validate scope_id.',
      NEW.scope_type;
  END IF;

  IF NOT scope_exists THEN
    RAISE EXCEPTION
      'invitations: scope_id % does not reference an active record '
      'in the expected table for scope_type ''%''. '
      'The record may not exist or may be soft-deleted.',
      NEW.scope_id, NEW.scope_type;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_invitation_scope() IS
  'BEFORE INSERT OR UPDATE trigger on invitations. '
  'Same pattern as validate_user_role_scope() from 0006. '
  'Verifies scope_id references an existing, non-soft-deleted row '
  'in the correct table for the given scope_type. '
  'Raises EXCEPTION if the referenced entity does not exist or is soft-deleted.';

CREATE TRIGGER trg_invitations_validate_scope
  BEFORE INSERT OR UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION validate_invitation_scope();


-- =============================================================================
-- TRIGGER: updated_at
-- Reuses set_updated_at() defined in 0002_create_languages.sql.
-- =============================================================================
CREATE TRIGGER trg_invitations_set_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- End of 0008_create_invitations.sql
--
-- Objects created:
--   TABLE      invitations
--   CONSTRAINT uq_invitations_token_hash                (unique, security)
--   CONSTRAINT chk_invitations_scope_id_global          (scope nullability)
--   CONSTRAINT chk_invitations_expires_after_created    (temporal validity)
--   CONSTRAINT chk_invitations_acceptance_state_consistent (bidirectional acceptance state)
--   CONSTRAINT chk_invitations_accepted_after_created   (temporal validity)
--   INDEX      uq_invitations_pending_scoped            (unique partial, non-global)
--   INDEX      uq_invitations_pending_global            (unique partial, global)
--   INDEX      idx_invitations_invited_email            (email lookup)
--   INDEX      idx_invitations_status                   (status filter)
--   INDEX      idx_invitations_scope                    (scope lookup)
--   INDEX      idx_invitations_expires_at               (expiry job)
--   INDEX      idx_invitations_invited_by               (admin audit)
--   INDEX      idx_invitations_deleted_at               (soft delete)
--   FUNCTION   validate_invitation_scope()              (scope existence check)
--   TRIGGER    trg_invitations_validate_scope           (BEFORE INSERT OR UPDATE)
--   TRIGGER    trg_invitations_set_updated_at           (updated_at)
--
-- Key design decisions:
--   - token_hash only — raw token never stored (security requirement)
--   - invited_email (not email) — avoids ambiguity with accepting user's email
--   - accepted_by — explicit FK for who accepted (may differ from invited_email owner)
--   - Two partial unique indexes for pending deduplication (handles NULL scope_id)
--   - Four table-level CHECK constraints for state consistency
--   - validate_invitation_scope mirrors validate_user_role_scope pattern exactly
--   - No API routes created
-- =============================================================================
