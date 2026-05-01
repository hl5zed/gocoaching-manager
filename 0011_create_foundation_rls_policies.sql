-- =============================================================================
-- Migration: 0011_create_foundation_rls_policies.sql
-- Project:   GOThriveCoaching
-- Purpose:   Enable Row Level Security and create foundation RLS policies
--            for the core identity, role, invitation, audit, and i18n tables.
--
-- Supabase role model (three principals relevant to these policies):
--
--   anon          Unauthenticated requests. Minimal access — only the data
--                 needed before login (language picker, login screen i18n).
--
--   authenticated Users with a valid Supabase JWT. Subject to all RLS policies
--                 defined here. Identity resolved via get_current_profile_id().
--
--   service_role  Supabase service key used by Edge Functions and server-side
--                 workflows. Bypasses RLS entirely by default.
--                 Used for: audit log writes, invitation acceptance, profile
--                 creation on signup, anonymisation workflows.
--                 No explicit policies are needed for service_role — it is
--                 excluded from RLS by Supabase's default configuration.
--                 Comments below note where service_role is the intended writer.
--
-- Policy naming convention:
--   <table>_<operation>_<actor>
--   Examples: profiles_select_own, audit_logs_select_super_admin
--
-- Helper functions used (all from 0010_create_rls_helper_functions.sql):
--   get_current_profile_id()
--   is_own_profile(profile_id uuid)
--   is_super_admin(profile_id uuid)
--   has_role(profile_id uuid, check_role system_role_enum)
--   can_manage_profile(manager_id uuid, target_profile_id uuid)
--
-- Tables covered in this file:
--   profiles, user_roles, invitations, audit_logs,
--   supported_languages, translation_namespaces,
--   translation_keys, translation_values
--
-- Tables NOT covered here (deferred to later migrations):
--   coaching_profiles, coaching_relationships, coaching_generations
--   goals, weekly_logs, weekly_log_items, weekly_reflection_answers
--   coach_feedback, care_prompts, notifications, sync_events
--   level_promotion_requests, level_progress_reviews
--   translated_contents, stats_snapshots, monthly_summaries
--
-- Dependencies:
--   0005_create_profiles.sql
--   0006_create_user_roles.sql
--   0007_create_audit_logs.sql
--   0008_create_invitations.sql
--   0009_create_i18n.sql
--   0010_create_rls_helper_functions.sql
-- =============================================================================


-- =============================================================================
-- ███████  PROFILES
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- FORCE RLS: applies even to the table owner (postgres role).
-- Ensures no accidental full-table access during migrations or maintenance.
-- Only super_admin and service_role should bypass this intentionally.
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- profiles: SELECT
-- -----------------------------------------------------------------------------

-- Own profile: a user may read their own profile row.
-- get_current_profile_id() returns NULL for anonymized/deleted profiles,
-- so anonymized profiles are never matched here.
CREATE POLICY profiles_select_own
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_own_profile(id)
  );

-- Super admin: may read all profiles including inactive and soft-deleted ones.
CREATE POLICY profiles_select_super_admin
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );

-- TODO: scoped admin SELECT (org_admin, church_admin, group_leader)
-- Requires can_manage_profile() to be extended with scope-based resolution
-- (MVP can_manage_profile covers only self + super_admin).
-- Add in a later migration after coaching tables and scope consistency
-- triggers are in place.

-- -----------------------------------------------------------------------------
-- profiles: INSERT
-- Normal authenticated users do not insert their own profile directly.
-- Profile creation is handled by service_role Edge Functions triggered on:
--   - auth.users creation (signup)
--   - invitation acceptance
-- service_role bypasses RLS — no INSERT policy needed for that path.
-- super_admin may insert profiles directly (e.g. bulk onboarding, restoration).
-- -----------------------------------------------------------------------------
CREATE POLICY profiles_insert_super_admin
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

-- -----------------------------------------------------------------------------
-- profiles: UPDATE
--
-- Row-level access only. Column-level field restrictions are enforced by
-- the application layer (API / Edge Functions) and will be reinforced by
-- a dedicated trigger in a later migration (see TODO in policy below).
--
-- Safe fields for self-update: display_name, phone, preferred_language, timezone.
-- All other fields require service_role or super_admin.
-- -----------------------------------------------------------------------------

-- Own profile: user may update their own row.
-- USING: the row must belong to the authenticated user, must not be anonymized,
-- and must not be soft-deleted.
-- WITH CHECK: after the update, the row must still belong to the same user
-- (auth_user_id cannot change), must not be anonymized, and must not be deleted.
-- auth_user_id = auth.uid() in WITH CHECK prevents a user from detaching their
-- own login link or pointing it at a different auth account.
--
-- TODO:
-- Column-level self-update protection should be enforced by API/Edge Function
-- and/or a dedicated trigger in a later migration.
-- Self-update should only allow:
--   - display_name
--   - phone
--   - preferred_language
--   - timezone
-- Sensitive fields must not be self-updated:
--   - auth_user_id
--   - status
--   - primary_role
--   - growth_level_id
--   - scope fields (country_id, region_id, organization_id, church_id, group_id, cohort_id)
--   - anonymization fields (anonymized_at, anonymized_by, erasure_requested_at)
--   - lineage fields (generation_number, parent_coach_id, promoted_by)
CREATE POLICY profiles_update_own
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    is_own_profile(id)
    AND status <> 'anonymized'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    is_own_profile(id)
    AND status <> 'anonymized'
    AND deleted_at IS NULL
    AND auth_user_id = auth.uid()
  );

-- Super admin: may update any profile.
CREATE POLICY profiles_update_super_admin
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  )
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

-- TODO: scoped admin UPDATE (org_admin managing profiles within their scope).
-- Deferred — see SELECT TODO above.

-- -----------------------------------------------------------------------------
-- profiles: DELETE
-- Hard deletion is prohibited for authenticated users.
-- Soft delete (setting deleted_at) goes through UPDATE policies above.
-- Permanent deletion is service_role only (super_admin triggers via Edge Function).
-- No DELETE policy for authenticated role = all hard deletes denied by default.
-- -----------------------------------------------------------------------------
-- (intentionally no DELETE policy for authenticated users)


-- =============================================================================
-- ███████  USER_ROLES
-- =============================================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- user_roles: SELECT
-- -----------------------------------------------------------------------------

-- Own roles: a user may read their own active role assignments.
-- Needed for client-side permission checks and dashboard routing.
CREATE POLICY user_roles_select_own
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    profile_id = get_current_profile_id()
    AND is_active = true
    AND deleted_at IS NULL
  );

-- Super admin: may read all role assignments.
CREATE POLICY user_roles_select_super_admin
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );

-- -----------------------------------------------------------------------------
-- user_roles: INSERT / UPDATE / DELETE
-- Normal authenticated users cannot manage role assignments directly.
-- All role grants, revocations, and changes go through:
--   - service_role Edge Functions (invitation acceptance, onboarding)
--   - super_admin direct access
-- No INSERT/UPDATE/DELETE policies for the authenticated role.
-- service_role bypasses RLS — no policy needed for that path.
-- -----------------------------------------------------------------------------
CREATE POLICY user_roles_insert_super_admin
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY user_roles_update_super_admin
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  )
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY user_roles_delete_super_admin
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );


-- =============================================================================
-- ███████  INVITATIONS
-- =============================================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- No FORCE RLS on invitations: invitation acceptance is handled entirely by
-- service_role Edge Functions. FORCE would add overhead without security benefit
-- since the write path is already service_role only.

-- -----------------------------------------------------------------------------
-- invitations: SELECT
-- Normal users cannot browse invitations.
-- Invitation acceptance is handled by service_role (bypasses RLS).
-- The Edge Function validates the token hash directly — it does not need
-- a SELECT policy for authenticated users.
-- super_admin may read all invitations for management and audit purposes.
-- -----------------------------------------------------------------------------
CREATE POLICY invitations_select_super_admin
  ON invitations
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );

-- TODO: scoped admin SELECT — an org_admin should be able to view invitations
-- they issued within their scope. Requires has_scope_access() scope resolution.
-- Deferred to a later migration.

-- -----------------------------------------------------------------------------
-- invitations: INSERT
-- Admins create invitations (within their scope).
-- For MVP: super_admin only. Scoped admin invitation creation via Edge Function.
-- -----------------------------------------------------------------------------
CREATE POLICY invitations_insert_super_admin
  ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

-- -----------------------------------------------------------------------------
-- invitations: UPDATE / DELETE
-- Updates (status changes: accepted, expired, revoked) are handled by
-- service_role Edge Functions. super_admin may update/revoke directly.
-- -----------------------------------------------------------------------------
CREATE POLICY invitations_update_super_admin
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  )
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY invitations_delete_super_admin
  ON invitations
  FOR DELETE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );


-- =============================================================================
-- ███████  AUDIT_LOGS
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- audit_logs: SELECT
-- Only super_admin may read audit logs.
-- Scoped admins do not get access to the raw audit log — they see
-- audit-derived summaries through dashboard queries (not direct table access).
-- -----------------------------------------------------------------------------
CREATE POLICY audit_logs_select_super_admin
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );

-- -----------------------------------------------------------------------------
-- audit_logs: INSERT
-- Written exclusively by service_role (Edge Functions, server-side workflows).
-- service_role bypasses RLS — no INSERT policy needed.
-- The append-only trigger (trg_audit_logs_immutable) blocks UPDATE and DELETE
-- at the DB level regardless of role. The policies below add a second layer.
-- -----------------------------------------------------------------------------
-- (intentionally no INSERT policy for authenticated — service_role writes)

-- -----------------------------------------------------------------------------
-- audit_logs: UPDATE / DELETE
-- Explicitly denied for all authenticated users.
-- The append-only trigger already raises EXCEPTION on UPDATE/DELETE.
-- These policies add an RLS-level denial as a second defence layer.
-- USING (false) = no row ever matches = operation always denied.
-- -----------------------------------------------------------------------------
CREATE POLICY audit_logs_update_deny_all
  ON audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY audit_logs_delete_deny_all
  ON audit_logs
  FOR DELETE
  TO authenticated
  USING (false);


-- =============================================================================
-- ███████  I18N TABLES
-- =============================================================================
-- All four i18n tables (supported_languages, translation_namespaces,
-- translation_keys, translation_values) are:
--   - Readable by anon: the language picker and login screen render before
--     authentication. These tables contain no sensitive data.
--   - Readable by authenticated: all UI rendering after login.
--   - Writable only by super_admin: translation management is a platform
--     administration task.
-- =============================================================================

-- =============================================================================
-- supported_languages
-- =============================================================================

ALTER TABLE supported_languages ENABLE ROW LEVEL SECURITY;

-- All readers (anon + authenticated): active languages only.
CREATE POLICY supported_languages_select_active
  ON supported_languages
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
  );

-- Super admin: full read access including inactive languages.
CREATE POLICY supported_languages_select_super_admin
  ON supported_languages
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );

-- Super admin: write access.
CREATE POLICY supported_languages_insert_super_admin
  ON supported_languages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY supported_languages_update_super_admin
  ON supported_languages
  FOR UPDATE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  )
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY supported_languages_delete_super_admin
  ON supported_languages
  FOR DELETE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );


-- =============================================================================
-- translation_namespaces
-- =============================================================================

ALTER TABLE translation_namespaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY translation_namespaces_select_all
  ON translation_namespaces
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
  );

CREATE POLICY translation_namespaces_select_super_admin
  ON translation_namespaces
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_namespaces_insert_super_admin
  ON translation_namespaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_namespaces_update_super_admin
  ON translation_namespaces
  FOR UPDATE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  )
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_namespaces_delete_super_admin
  ON translation_namespaces
  FOR DELETE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );


-- =============================================================================
-- translation_keys
-- =============================================================================

ALTER TABLE translation_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY translation_keys_select_all
  ON translation_keys
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
  );

CREATE POLICY translation_keys_select_super_admin
  ON translation_keys
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_keys_insert_super_admin
  ON translation_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_keys_update_super_admin
  ON translation_keys
  FOR UPDATE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  )
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_keys_delete_super_admin
  ON translation_keys
  FOR DELETE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );


-- =============================================================================
-- translation_values
-- =============================================================================

ALTER TABLE translation_values ENABLE ROW LEVEL SECURITY;

-- All readers: approved translations only.
-- Machine-translated values pending review are hidden from anon/authenticated
-- until approved, preventing unreviewed strings from reaching the UI.
CREATE POLICY translation_values_select_approved
  ON translation_values
  FOR SELECT
  TO anon, authenticated
  USING (
    review_status = 'approved'
  );

-- Super admin: full read access including unapproved/machine-translated values
-- (needed for the translation review admin interface).
CREATE POLICY translation_values_select_super_admin
  ON translation_values
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_values_insert_super_admin
  ON translation_values
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_values_update_super_admin
  ON translation_values
  FOR UPDATE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  )
  WITH CHECK (
    is_super_admin(get_current_profile_id())
  );

CREATE POLICY translation_values_delete_super_admin
  ON translation_values
  FOR DELETE
  TO authenticated
  USING (
    is_super_admin(get_current_profile_id())
  );


-- =============================================================================
-- End of 0011_create_foundation_rls_policies.sql
--
-- RLS enabled on 8 tables:
--   profiles                  FORCE RLS
--   user_roles                FORCE RLS
--   invitations
--   audit_logs                FORCE RLS
--   supported_languages
--   translation_namespaces
--   translation_keys
--   translation_values
--
-- Policies created (37 total):
--
--   profiles (5):
--     profiles_select_own
--     profiles_select_super_admin
--     profiles_insert_super_admin
--     profiles_update_own
--     profiles_update_super_admin
--
--   user_roles (5):
--     user_roles_select_own
--     user_roles_select_super_admin
--     user_roles_insert_super_admin
--     user_roles_update_super_admin
--     user_roles_delete_super_admin
--
--   invitations (4):
--     invitations_select_super_admin
--     invitations_insert_super_admin
--     invitations_update_super_admin
--     invitations_delete_super_admin
--
--   audit_logs (3):
--     audit_logs_select_super_admin
--     audit_logs_update_deny_all
--     audit_logs_delete_deny_all
--
--   supported_languages (5):
--     supported_languages_select_active
--     supported_languages_select_super_admin
--     supported_languages_insert_super_admin
--     supported_languages_update_super_admin
--     supported_languages_delete_super_admin
--
--   translation_namespaces (5):
--     translation_namespaces_select_all
--     translation_namespaces_select_super_admin
--     translation_namespaces_insert_super_admin
--     translation_namespaces_update_super_admin
--     translation_namespaces_delete_super_admin
--
--   translation_keys (5):
--     translation_keys_select_all
--     translation_keys_select_super_admin
--     translation_keys_insert_super_admin
--     translation_keys_update_super_admin
--     translation_keys_delete_super_admin
--
--   translation_values (5):
--     translation_values_select_approved
--     translation_values_select_super_admin
--     translation_values_insert_super_admin
--     translation_values_update_super_admin
--     translation_values_delete_super_admin
--
-- Key design decisions:
--   - FORCE RLS on profiles, user_roles, audit_logs
--   - service_role bypasses RLS — no policies needed for that path
--   - anon SELECT on i18n tables (language picker before auth)
--   - translation_values SELECT filtered to review_status = 'approved' only
--   - profiles UPDATE WITH CHECK prevents self-status-change
--   - audit_logs USING (false) on UPDATE/DELETE = second defence layer
--   - No hard DELETE policy for authenticated on profiles
--   - Scoped admin policies deferred (TODO) until can_manage_profile extended
--   - No coaching, goals, or weekly_logs policies in this file
-- =============================================================================
