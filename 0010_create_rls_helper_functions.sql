-- =============================================================================
-- Migration: 0010_create_rls_helper_functions.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create helper functions used by all RLS policies on the platform.
--
-- Design principles:
--
--   1. No RLS policies in this file — only the functions policies will call.
--      Policies are created in a later dedicated migration.
--
--   2. All functions are SECURITY DEFINER.
--      RLS policies execute in the calling user's security context. Without
--      SECURITY DEFINER, a user subject to a policy could not query user_roles
--      or profiles to evaluate that same policy — creating a deadlock.
--      SECURITY DEFINER elevates execution to the function owner's privileges
--      for the duration of the call.
--
--   3. SECURITY DEFINER is used carefully:
--      - SET search_path = public on every function prevents search path
--        injection (a malicious schema cannot shadow profiles or user_roles).
--      - Every function takes explicit profile_id arguments — no bulk data
--        exposure via SECURITY DEFINER.
--      - Functions return boolean or uuid, never row data.
--      - Anonymised profiles are blocked at get_current_profile_id() and
--        cannot reach any other helper function as an authenticated identity.
--
--   4. All functions are STABLE — no DB writes, same result within a
--      transaction for the same arguments. PostgreSQL may cache results
--      within a query, reducing per-row evaluation cost.
--
--   5. get_current_profile_id() is the single point of auth.uid() resolution.
--      All other functions accept an explicit profile_id uuid argument.
--      This keeps the auth.* surface minimal and testable.
--
--   6. user_roles is the source of truth for all role and scope checks.
--      profiles.primary_role is used only for dashboard routing and is never
--      consulted here.
--
-- Functions created:
--   get_current_profile_id()
--   is_super_admin(profile_id uuid)
--   has_role(profile_id uuid, check_role system_role_enum)
--   has_scope_access(profile_id uuid, check_scope_type scope_type_enum,
--                    check_scope_id uuid)
--   is_own_profile(profile_id uuid)
--   can_manage_profile(manager_id uuid, target_profile_id uuid)
--
-- TODO (requires coaching tables not yet created):
--   is_assigned_coach(coach_id uuid, coachee_id uuid)
--   can_view_weekly_log(viewer_id uuid, weekly_log_id uuid)
--   can_rebuild_lineage_tree(actor_id uuid, changed_user_id uuid)
--
-- Dependencies:
--   0001_create_enums.sql         → system_role_enum, scope_type_enum,
--                                    profile_status_enum
--   0005_create_profiles.sql      → profiles table
--   0006_create_user_roles.sql    → user_roles table
-- =============================================================================


-- =============================================================================
-- FUNCTION: get_current_profile_id()
--
-- Resolves auth.uid() to the application profiles.id for the current request.
-- This is the single authoritative identity resolver for all RLS policies.
--
-- Returns NULL (not an exception) when:
--   - The request is unauthenticated (auth.uid() is null)
--   - auth.uid() exists but no profile has that auth_user_id
--     (e.g. during onboarding before profile creation)
--   - The matching profile has status = 'anonymized'
--     (per spec: anonymized profiles must not be accessible as personal accounts)
--   - The matching profile has a non-null deleted_at
--     (soft-deleted profiles are not accessible)
--
-- Returning NULL causes all boolean helper functions to return false, which
-- causes RLS policies to deny access — the correct and safe failure mode.
--
-- Usage in RLS policies:
--   USING ( get_current_profile_id() = user_id )
--   USING ( is_super_admin( get_current_profile_id() ) )
-- =============================================================================
CREATE OR REPLACE FUNCTION get_current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
    FROM profiles p
   WHERE p.auth_user_id = auth.uid()
     AND p.status       <> 'anonymized'
     AND p.deleted_at   IS NULL
   LIMIT 1;
$$;

COMMENT ON FUNCTION get_current_profile_id() IS
  'Resolves auth.uid() to profiles.id for the current request. '
  'Returns NULL if unauthenticated, if no profile exists for the auth user, '
  'if the profile is anonymized, or if the profile is soft-deleted. '
  'This is the single point of auth.uid() resolution. All RLS policies should '
  'call this function rather than querying profiles directly. '
  'SECURITY DEFINER with SET search_path = public.';


-- =============================================================================
-- FUNCTION: is_super_admin(profile_id uuid)
--
-- Returns true if the profile holds an active super_admin role.
-- Super admins have global scope and may manage all data on the platform.
--
-- Returns false if:
--   - profile_id is null
--   - the profile has no active super_admin role in user_roles
--
-- Note: super_admin is always scoped globally (scope_type = 'global').
-- No scope_id check is needed.
-- =============================================================================
CREATE OR REPLACE FUNCTION is_super_admin(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM user_roles ur
     WHERE ur.profile_id  = $1
       AND ur.role        = 'super_admin'
       AND ur.is_active   = true
       AND ur.deleted_at  IS NULL
       AND (ur.expires_at IS NULL OR ur.expires_at > now())
  );
$$;

COMMENT ON FUNCTION is_super_admin(uuid) IS
  'Returns true if the given profile_id holds an active super_admin role. '
  'Super admins may manage all data on the platform regardless of scope. '
  'Returns false for null input. Checks user_roles — not profiles.primary_role. '
  'Also checks expires_at so time-limited super_admin grants are respected. '
  'SECURITY DEFINER with SET search_path = public.';


-- =============================================================================
-- FUNCTION: has_role(profile_id uuid, check_role system_role_enum)
--
-- Returns true if the profile holds the given role at any active scope.
-- This is scope-agnostic — it answers "does this person have this role at all?"
-- For scope-specific checks, use has_scope_access().
--
-- Returns false if:
--   - profile_id is null
--   - the role is not present in user_roles with is_active = true
--
-- Usage examples:
--   has_role(get_current_profile_id(), 'coach')
--   has_role(get_current_profile_id(), 'church_admin')
-- =============================================================================
CREATE OR REPLACE FUNCTION has_role(profile_id uuid, check_role system_role_enum)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM user_roles ur
     WHERE ur.profile_id  = $1
       AND ur.role        = $2
       AND ur.is_active   = true
       AND ur.deleted_at  IS NULL
       AND (ur.expires_at IS NULL OR ur.expires_at > now())
  );
$$;

COMMENT ON FUNCTION has_role(uuid, system_role_enum) IS
  'Returns true if the given profile_id holds the given role at any active scope. '
  'Scope-agnostic: answers "does this person have this role at all?". '
  'For scope-specific access checks, use has_scope_access(). '
  'Checks user_roles — not profiles.primary_role. '
  'Returns false for null profile_id. Respects expires_at. '
  'SECURITY DEFINER with SET search_path = public.';


-- =============================================================================
-- FUNCTION: has_scope_access(profile_id uuid,
--                             check_scope_type scope_type_enum,
--                             check_scope_id uuid)
--
-- Returns true if the profile has an active role that grants access to the
-- requested scope entity.
--
-- Access is granted when any of the following is true:
--   1. The profile is a super_admin (global access via is_super_admin()).
--   2. The profile has an active role scoped exactly to
--      (check_scope_type, check_scope_id).
--
-- Security note — global-scope roles do NOT grant universal access:
--   A role stored with scope_type = 'global' in user_roles represents a role
--   that was assigned without a specific entity scope. However, non-super_admin
--   roles (coach, coachee, group_leader, coach_maker, etc.) assigned at global
--   scope must NOT automatically receive access to every country, organisation,
--   church, group, or cohort on the platform. Universal access is reserved
--   exclusively for super_admin. All other roles require an exact scope match
--   or explicit hierarchical delegation (see TODO below).
--
-- MVP scope: super_admin universal + exact match only.
--
-- TODO — Hierarchical scope resolution (requires geography tables and
-- coaching tables to be fully available):
--   A country_admin for country C should implicitly have access to all
--   organizations, churches, groups, and cohorts within C.
--   An organization_admin for org O should implicitly have access to all
--   churches, groups, and cohorts under O.
--   Full hierarchical resolution requires joining geography tables to trace
--   the parent chain of check_scope_id. This will be added in a later
--   migration once query patterns across all coaching tables are understood
--   and performance characteristics can be evaluated.
--
-- check_scope_id:
--   Pass NULL only when check_scope_type = 'global'.
--   For all other scope types, check_scope_id must be the UUID of the
--   specific entity being accessed.
--
-- Returns false if:
--   - profile_id is null
--   - no qualifying active role exists in user_roles
-- =============================================================================
CREATE OR REPLACE FUNCTION has_scope_access(
  profile_id       uuid,
  check_scope_type scope_type_enum,
  check_scope_id   uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Case 1: super_admin has universal access
    is_super_admin($1)

    OR

    -- Case 2: profile has an active role scoped exactly to the requested entity.
    -- Global-scope roles (scope_type = 'global') held by non-super_admin profiles
    -- do NOT grant universal access — they match only when check_scope_type = 'global'
    -- is explicitly requested, i.e. when the caller is checking global-level access.
    EXISTS (
      SELECT 1
        FROM user_roles ur
       WHERE ur.profile_id  = $1
         AND ur.scope_type  = $2
         AND ur.scope_id    IS NOT DISTINCT FROM $3
         AND ur.is_active   = true
         AND ur.deleted_at  IS NULL
         AND (ur.expires_at IS NULL OR ur.expires_at > now())
    );
$$;

COMMENT ON FUNCTION has_scope_access(uuid, scope_type_enum, uuid) IS
  'Returns true if the profile has an active role granting access to the '
  'given scope entity. '
  'Grants access for: (1) super_admin universal access, '
  '(2) exact (scope_type, scope_id) match in user_roles. '
  'Security: global-scope roles held by non-super_admin profiles do NOT '
  'grant universal access to all data. A global-scope coach, coachee, or '
  'group_leader must not see every country, org, church, or group. '
  'Universal access is reserved exclusively for super_admin. '
  'Uses IS NOT DISTINCT FROM for scope_id comparison to handle NULL '
  'correctly when checking global scope (NULL IS NOT DISTINCT FROM NULL = true). '
  'MVP: super_admin + exact match only. '
  'TODO: full hierarchical resolution (country → org → church → group → cohort) '
  'to be added in a later migration once geography join patterns are established. '
  'Returns false for null profile_id. Respects expires_at. '
  'SECURITY DEFINER with SET search_path = public.';


-- =============================================================================
-- FUNCTION: is_own_profile(profile_id uuid)
--
-- Returns true if the authenticated user's resolved profile id equals the
-- given profile_id. Used in RLS policies that allow users to access or
-- modify their own records.
--
-- Equivalent to: get_current_profile_id() = profile_id
-- Provided as a named function for readability in policy definitions.
--
-- Returns false if:
--   - get_current_profile_id() returns null (unauthenticated or anonymized)
--   - profile_id is null
--   - the two ids do not match
-- =============================================================================
CREATE OR REPLACE FUNCTION is_own_profile(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    $1 IS NOT NULL
    AND get_current_profile_id() IS NOT NULL
    AND get_current_profile_id() = $1;
$$;

COMMENT ON FUNCTION is_own_profile(uuid) IS
  'Returns true if the currently authenticated user''s profile id matches '
  'the given profile_id. '
  'Resolves the current user via get_current_profile_id(). '
  'Returns false for null inputs or unauthenticated requests. '
  'Used in RLS policies that allow users to read or modify their own records. '
  'SECURITY DEFINER with SET search_path = public.';


-- =============================================================================
-- FUNCTION: can_manage_profile(manager_id uuid, target_profile_id uuid)
--
-- Returns true if manager_id has permission to manage target_profile_id.
--
-- Management is allowed when any of the following is true:
--   1. The manager is the target (self-management).
--   2. The manager is a super_admin.
--   3. TODO: The manager holds an admin role whose scope contains the target
--      profile's assigned organisation, church, group, or cohort.
--      This requires joining profiles.organization_id / church_id / group_id /
--      cohort_id against user_roles.scope_id for the manager. Will be added
--      in a later migration once profile scope consistency triggers and
--      coaching relationship tables are in place.
--
-- Returns false if:
--   - manager_id is null
--   - target_profile_id is null
--   - neither condition above is satisfied
--
-- Usage in RLS policies:
--   USING ( can_manage_profile(get_current_profile_id(), id) )
-- =============================================================================
CREATE OR REPLACE FUNCTION can_manage_profile(
  manager_id        uuid,
  target_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    $1 IS NOT NULL
    AND $2 IS NOT NULL
    AND (
      -- Case 1: self-management
      $1 = $2

      OR

      -- Case 2: super_admin manages anyone
      is_super_admin($1)

      -- TODO Case 3: scoped admin manages profiles within their scope.
      -- Requires: SELECT p.organization_id, p.church_id, p.group_id, p.cohort_id
      --           FROM profiles p WHERE p.id = $2
      --           then check has_scope_access($1, ...) for each non-null scope.
      -- To be added in a later migration after profile scope consistency
      -- triggers and full coaching table set are in place.
    );
$$;

COMMENT ON FUNCTION can_manage_profile(uuid, uuid) IS
  'Returns true if manager_id has permission to manage target_profile_id. '
  'MVP: allows self-management and super_admin management. '
  'TODO: add scoped admin management (org_admin, church_admin, etc.) once '
  'profile scope consistency triggers and coaching tables are in place. '
  'Returns false for null inputs. '
  'Usage: can_manage_profile(get_current_profile_id(), profiles.id) '
  'SECURITY DEFINER with SET search_path = public.';


-- =============================================================================
-- TODO: Functions to be added in later migrations
--
-- is_assigned_coach(coach_id uuid, coachee_id uuid)
--   Requires: coaching_relationships table (not yet created).
--   Returns true if an active coaching_relationship exists between coach and
--   coachee. Used in RLS policies controlling coach access to coachee logs
--   and feedback.
--
-- can_view_weekly_log(viewer_id uuid, weekly_log_id uuid)
--   Requires: weekly_logs table and coaching_relationships (not yet created).
--   Returns true if viewer_id may read the given weekly log:
--     - The log belongs to the viewer (is_own_profile check on log.user_id).
--     - The viewer is an assigned coach of the log owner.
--     - The viewer is an admin with scope access over the log owner.
--   Private reflection fields are never exposed — that is enforced by column-
--   level security in the RLS policy itself, not by this function.
--
-- can_rebuild_lineage_tree(actor_id uuid, changed_user_id uuid)
--   Requires: coaching_generations table (not yet created).
--   Returns true if actor_id may trigger a lineage subtree rebuild for
--   changed_user_id. Allowed roles: super_admin, organization_admin within
--   scope, coach_maker within assigned scope.
-- =============================================================================


-- =============================================================================
-- End of 0010_create_rls_helper_functions.sql
--
-- Functions created:
--   get_current_profile_id()                         → uuid
--   is_super_admin(profile_id uuid)                  → boolean
--   has_role(profile_id uuid,
--            check_role system_role_enum)             → boolean
--   has_scope_access(profile_id uuid,
--                    check_scope_type scope_type_enum,
--                    check_scope_id uuid)             → boolean
--   is_own_profile(profile_id uuid)                  → boolean
--   can_manage_profile(manager_id uuid,
--                      target_profile_id uuid)        → boolean
--
-- All functions:
--   - SECURITY DEFINER — executes with owner privileges for RLS evaluation
--   - SET search_path = public — prevents search path injection
--   - STABLE — PostgreSQL may cache results within a query
--   - Return false for null inputs — safe denial, not exception
--   - Source of truth: user_roles (not profiles.primary_role)
--   - Anonymized profiles: blocked at get_current_profile_id()
--   - Expiry: all user_roles checks respect expires_at
--
-- Functions deferred to later migrations:
--   is_assigned_coach        (requires coaching_relationships)
--   can_view_weekly_log      (requires weekly_logs + coaching_relationships)
--   can_rebuild_lineage_tree (requires coaching_generations)
--
-- No RLS policies created in this file.
-- =============================================================================
