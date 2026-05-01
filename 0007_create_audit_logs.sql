-- =============================================================================
-- Migration: 0007_create_audit_logs.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the audit_logs table — the immutable, append-only record
--            of all significant actions taken on the platform.
--
-- Append-only design:
--   audit_logs must never be updated or soft-deleted.
--   Rules enforced at two layers:
--     1. No updated_at or deleted_at columns — makes the soft-delete and
--        update patterns structurally inapplicable to this table.
--     2. trg_audit_logs_immutable — a BEFORE UPDATE OR DELETE trigger that
--        raises EXCEPTION unconditionally. Even a direct SQL connection from
--        a super_admin cannot mutate or remove a row without first dropping
--        the trigger, which is itself a structural change that would be
--        visible in PostgreSQL system catalogs.
--
-- Sensitive data policy:
--   audit_logs may contain before/after snapshots of record changes.
--   Sensitive fields (PII, private reflections, tokens) must be masked or
--   omitted by application code BEFORE writing to this table.
--   The DB layer does not enforce masking — it is an application responsibility.
--   Only super_admin may view the full audit log.
--
-- Field name note:
--   Requirements use table_name / record_id / old_values / new_values.
--   Spec uses entity_type / entity_id / old_value / new_value.
--   This migration follows the requirements. The concept is identical:
--     table_name = the PostgreSQL table the audited record lives in.
--     record_id  = the uuid primary key of that record.
--   Spec fields reason and request_id are also included as they are not
--   contradicted by the requirements and add meaningful audit context.
--
-- No audit triggers on other tables in this file:
--   Triggers that write TO audit_logs (e.g. on profiles, user_roles, etc.)
--   will be created in a later dedicated migration.
--
-- Dependencies:
--   0000_create_extensions.sql    → gen_random_uuid()
--   0001_create_enums.sql         → audit_action_enum
--   0005_create_profiles.sql      → profiles(id)
-- =============================================================================


-- =============================================================================
-- TABLE: audit_logs
-- =============================================================================
CREATE TABLE audit_logs (

  id           uuid               PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The profile that performed the action. Nullable: system-initiated actions
  -- (scheduled jobs, Edge Functions) may have no actor profile.
  -- ON DELETE SET NULL: if an actor's profile is hard-deleted, the audit record
  -- is preserved with actor_id = null. The action itself is never removed.
  actor_id     uuid               REFERENCES profiles(id) ON DELETE SET NULL,

  -- The audited action. Uses audit_action_enum — no free-text action values.
  action       audit_action_enum  NOT NULL,

  -- The name of the PostgreSQL table the audited record belongs to.
  -- e.g. 'profiles', 'user_roles', 'coaching_relationships', 'weekly_logs'.
  table_name   text               NOT NULL
                 CHECK (length(trim(table_name)) > 0),

  -- The uuid primary key of the specific record that was acted on.
  -- Nullable: some audit actions are not tied to a specific row
  -- (e.g. rls_policy_sensitive_action, snapshot_recalculated).
  record_id    uuid,

  -- Snapshot of the record's relevant fields before the action.
  -- Application code must mask or omit sensitive fields (PII, tokens,
  -- private reflections) before writing here.
  -- NULL for INSERT actions (no prior state).
  old_values   jsonb,

  -- Snapshot of the record's relevant fields after the action.
  -- Application code must mask or omit sensitive fields.
  -- NULL for DELETE / anonymisation actions where the new state is absence.
  new_values   jsonb,

  -- Optional human-readable reason for the action.
  -- e.g. 'Anonymised at user request', 'Suspended for policy violation'.
  -- Must not contain PII or private text.
  reason       text,

  -- Optional correlation id linking multiple audit entries from the same
  -- API request, Edge Function invocation, or batch job run.
  request_id   text,

  -- Network context. Collected by the application layer and passed in.
  -- ip_address and user_agent are informational only; they are not
  -- used for authentication or authorisation decisions.
  ip_address   text,
  user_agent   text,

  -- Immutable creation timestamp. No updated_at — rows are never changed.
  created_at   timestamptz        NOT NULL DEFAULT now()

  -- No deleted_at column. Audit logs are never soft-deleted.
  -- No updated_at column. Audit logs are never updated.

);

-- Table-level comment
COMMENT ON TABLE audit_logs IS
  'Immutable, append-only record of all significant actions on the platform. '
  'Rows must never be updated or deleted — enforced by trg_audit_logs_immutable. '
  'Sensitive fields must be masked by application code before writing here. '
  'Only super_admin may view the full audit log. '
  'System-initiated actions (jobs, Edge Functions) may have actor_id = null.';

-- Column comments
COMMENT ON COLUMN audit_logs.actor_id IS
  'profiles.id of the user who performed the action. '
  'Nullable for system-initiated actions (scheduled jobs, Edge Functions). '
  'ON DELETE SET NULL: audit record is preserved even if the actor profile '
  'is hard-deleted; actor_id becomes null.';

COMMENT ON COLUMN audit_logs.action IS
  'The audited action. One of audit_action_enum values — no free-text allowed. '
  'Adding new audit action types requires ALTER TYPE audit_action_enum '
  'ADD VALUE in a separate migration.';

COMMENT ON COLUMN audit_logs.table_name IS
  'Name of the PostgreSQL table the audited record belongs to. '
  'e.g. profiles, user_roles, coaching_relationships, weekly_logs.';

COMMENT ON COLUMN audit_logs.record_id IS
  'UUID primary key of the specific record that was acted on. '
  'Nullable for actions not tied to a specific row '
  '(e.g. rls_policy_sensitive_action, snapshot_recalculated).';

COMMENT ON COLUMN audit_logs.old_values IS
  'JSONB snapshot of relevant fields before the action. '
  'NULL for INSERT actions (no prior state). '
  'Sensitive fields (PII, tokens, private reflections) must be masked '
  'or omitted by application code before writing here.';

COMMENT ON COLUMN audit_logs.new_values IS
  'JSONB snapshot of relevant fields after the action. '
  'NULL for DELETE or anonymisation actions. '
  'Sensitive fields must be masked or omitted by application code.';

COMMENT ON COLUMN audit_logs.reason IS
  'Optional human-readable reason for the action. '
  'Must not contain PII or private content. '
  'Examples: ''Anonymised at user request'', ''Role revoked by org admin''.';

COMMENT ON COLUMN audit_logs.request_id IS
  'Optional correlation id linking multiple audit entries from the same '
  'API request, Edge Function invocation, or batch job run. '
  'Useful for tracing the full impact of a single operation.';

COMMENT ON COLUMN audit_logs.ip_address IS
  'IP address of the client at the time of the action. '
  'Informational only — not used for authentication or authorisation.';

COMMENT ON COLUMN audit_logs.user_agent IS
  'HTTP User-Agent string of the client at the time of the action. '
  'Informational only.';

COMMENT ON COLUMN audit_logs.created_at IS
  'Immutable timestamp of when the audit record was written. '
  'There is no updated_at — this row will never be changed.';


-- =============================================================================
-- APPEND-ONLY PROTECTION TRIGGER
--
-- Raises EXCEPTION on any UPDATE or DELETE attempt.
-- This is the DB-level enforcement of the append-only rule.
--
-- Important:
--   This trigger does not prevent a super_admin from dropping it via DDL.
--   However, dropping a trigger is itself a structural change that would
--   be visible in PostgreSQL system catalogs and deployment history.
--   The intent is to prevent accidental or application-level mutations,
--   not to create an unbreakable cryptographic guarantee.
--
-- Note on TRUNCATE:
--   TRUNCATE is not covered by row-level triggers in PostgreSQL.
--   TRUNCATE access on audit_logs should be restricted via GRANT / REVOKE
--   at the database role level (handled in a later RLS/permissions migration).
-- =============================================================================
CREATE OR REPLACE FUNCTION enforce_audit_logs_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'audit_logs is append-only. UPDATE is not permitted. '
      'Row id: %, action: %',
      OLD.id, OLD.action;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'audit_logs is append-only. DELETE is not permitted. '
      'Row id: %, action: %',
      OLD.id, OLD.action;
  END IF;

  -- Should not be reached, but return OLD defensively.
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION enforce_audit_logs_immutable() IS
  'BEFORE UPDATE OR DELETE trigger on audit_logs. '
  'Raises EXCEPTION unconditionally to enforce the append-only rule. '
  'Audit records must never be modified or removed after creation. '
  'Only a deliberate DDL operation (DROP TRIGGER) can bypass this guard.';

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_audit_logs_immutable();


-- =============================================================================
-- INDEXES
--
-- actor_id         — "show all actions by this user"
-- action           — "show all events of this type" (compliance, reporting)
-- (table_name, record_id) — "show full audit history for this specific record"
-- created_at       — time-range queries for audit viewer and retention jobs
-- =============================================================================

-- actor_id: who performed actions (required by spec: audit_logs(actor_id, ...))
CREATE INDEX idx_audit_logs_actor_id
  ON audit_logs (actor_id)
  WHERE actor_id IS NOT NULL;

-- action: filter by action type
CREATE INDEX idx_audit_logs_action
  ON audit_logs (action);

-- (table_name, record_id): full history for a specific record
-- Also satisfies the spec's compound requirement:
--   audit_logs(actor_id, entity_type, entity_id) →
--   implemented as separate actor_id + (table_name, record_id) indexes
--   for more flexible query patterns.
CREATE INDEX idx_audit_logs_table_record
  ON audit_logs (table_name, record_id)
  WHERE record_id IS NOT NULL;

-- created_at: time-range queries, pagination, archival
CREATE INDEX idx_audit_logs_created_at
  ON audit_logs (created_at);


-- =============================================================================
-- TODO: audit trigger functions on other tables
--
-- In a later dedicated migration, create AFTER INSERT / UPDATE / DELETE
-- trigger functions on the following tables that write to audit_logs:
--
--   profiles           → soft_delete_profile, restore_profile,
--                         profile_updated_by_admin, profile_anonymized,
--                         auth_user_disconnected, user_requested_erasure
--   user_roles         → role_changed
--   coaching_relationships → coach_assigned, coach_changed,
--                             coaching_relationship_ended
--   coaching_generations   → lineage_parent_changed, lineage_subtree_rebuilt,
--                             lineage_rebuild_failed
--   level_promotion_requests → promotion_approved, promotion_rejected,
--                               growth_level_promoted
--   weekly_logs        → weekly_log_soft_deleted, restore_weekly_log
--
-- Application code (Edge Functions) is responsible for audit entries that
-- require request-level context (ip_address, user_agent, request_id) since
-- DB triggers cannot access HTTP request metadata.
-- =============================================================================


-- =============================================================================
-- End of 0007_create_audit_logs.sql
--
-- Objects created:
--   TABLE     audit_logs
--   FUNCTION  enforce_audit_logs_immutable()       (append-only guard)
--   TRIGGER   trg_audit_logs_immutable             (BEFORE UPDATE OR DELETE)
--   INDEX     idx_audit_logs_actor_id              (actor lookup)
--   INDEX     idx_audit_logs_action                (action type filter)
--   INDEX     idx_audit_logs_table_record          (record history lookup)
--   INDEX     idx_audit_logs_created_at            (time-range queries)
--
-- Key design decisions:
--   - No updated_at column — rows are never changed
--   - No deleted_at column — rows are never soft-deleted
--   - Append-only enforced by BEFORE UPDATE OR DELETE trigger (EXCEPTION)
--   - actor_id ON DELETE SET NULL — audit record survives actor deletion
--   - table_name + record_id (not entity_type + entity_id) per requirements
--   - reason and request_id included from spec (not contradicted)
--   - old_values / new_values as jsonb — structured, queryable snapshots
--   - Sensitive data masking is an application responsibility, not DB-enforced
--   - Audit triggers on other tables deferred to a later migration
--   - No invitations table created
-- =============================================================================
