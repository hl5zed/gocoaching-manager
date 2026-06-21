-- =============================================================================
-- Migration: 0040_my_coaching_weekly_logs_rls.sql
-- Project:   GOThriveCoaching
-- Purpose:   Unified RLS for /my-coaching service_role reduction (staging-first).
--
-- Scope:
--   - weekly_logs (coachee + coach + super_admin)
--   - assigned coach limited read (RPC)
--   - organization timezone read (RPC)
--   - organizations admin/super_admin policies (required when enabling org RLS)
--
-- Notes:
--   - Merges docs/my-coaching-rls-suggestions.sql and
--     docs/rls-drafts/0037_weekly_logs_lookup_tables_rls_review.sql (my-coaching subset).
--   - Does NOT include countries/regions/churches/groups from 0037 draft.
--   - Reuses public.current_profile_id() from 0024.
--   - Soft delete pattern follows 0027 monthly_reflections fix.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: active super_admin check (matches 0037 / system_settings pattern)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_super_admin_profile()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.profile_id = p.id
    WHERE p.id = public.current_profile_id()
      AND p.status = 'active'
      AND p.deleted_at IS NULL
      AND ur.role = 'super_admin'
      AND ur.status = 'active'
      AND ur.is_active = true
      AND ur.scope_type = 'global'
      AND ur.scope_id IS NULL
      AND ur.deleted_at IS NULL
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  );
$$;

COMMENT ON FUNCTION public.is_active_super_admin_profile() IS
  'Returns true when the current profile is an active global super_admin.';

-- -----------------------------------------------------------------------------
-- Helper: weekly log ↔ active coaching relationship ownership
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.weekly_log_has_active_coachee_relationship(
  p_relationship_id uuid,
  p_coachee_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.id = p_relationship_id
      AND cr.coachee_profile_id = public.current_profile_id()
      AND cr.coachee_profile_id = p_coachee_profile_id
      AND cr.status = 'active'
      AND cr.deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.weekly_log_has_active_coachee_relationship(uuid, uuid) IS
  'True when relationship belongs to current coachee profile and is active.';

-- -----------------------------------------------------------------------------
-- weekly_logs
-- -----------------------------------------------------------------------------

ALTER TABLE public.weekly_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_logs_select_own_coachee ON public.weekly_logs;
DROP POLICY IF EXISTS "coachee can read own weekly logs" ON public.weekly_logs;
CREATE POLICY weekly_logs_select_own_coachee
  ON public.weekly_logs
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND coachee_profile_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS weekly_logs_insert_own_coachee ON public.weekly_logs;
DROP POLICY IF EXISTS "coachee can insert own weekly logs" ON public.weekly_logs;
CREATE POLICY weekly_logs_insert_own_coachee
  ON public.weekly_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND coachee_profile_id = public.current_profile_id()
    AND status IN ('draft', 'submitted')
    AND public.weekly_log_has_active_coachee_relationship(
      relationship_id,
      coachee_profile_id
    )
  );

DROP POLICY IF EXISTS weekly_logs_update_own_coachee ON public.weekly_logs;
DROP POLICY IF EXISTS "coachee can update own weekly logs" ON public.weekly_logs;
CREATE POLICY weekly_logs_update_own_coachee
  ON public.weekly_logs
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND coachee_profile_id = public.current_profile_id()
    AND status <> 'archived'
  )
  WITH CHECK (
    coachee_profile_id = public.current_profile_id()
    AND (
      deleted_at IS NOT NULL
      OR (
        deleted_at IS NULL
        AND status <> 'archived'
        AND status IN ('draft', 'submitted')
        AND public.weekly_log_has_active_coachee_relationship(
          relationship_id,
          coachee_profile_id
        )
      )
    )
  );

DROP POLICY IF EXISTS weekly_logs_select_assigned_coach_submitted ON public.weekly_logs;
DROP POLICY IF EXISTS "coach can read assigned coachee weekly logs" ON public.weekly_logs;
CREATE POLICY weekly_logs_select_assigned_coach_submitted
  ON public.weekly_logs
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1
      FROM public.coaching_relationships cr
      WHERE cr.id = public.weekly_logs.relationship_id
        AND cr.coach_profile_id = public.current_profile_id()
        AND cr.coachee_profile_id = public.weekly_logs.coachee_profile_id
        AND cr.status = 'active'
        AND cr.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS weekly_logs_select_active_super_admin ON public.weekly_logs;
CREATE POLICY weekly_logs_select_active_super_admin
  ON public.weekly_logs
  FOR SELECT
  TO authenticated
  USING (public.is_active_super_admin_profile());

-- Intentionally no weekly_logs DELETE policy (soft delete via UPDATE only).

-- -----------------------------------------------------------------------------
-- Assigned coach profiles — RPC (limited columns, preferred over profiles RLS)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_assigned_coach_profiles()
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  email text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.full_name,
    p.email,
    p.status::text
  FROM public.profiles p
  INNER JOIN public.coaching_relationships cr
    ON cr.coach_profile_id = p.id
  WHERE cr.coachee_profile_id = public.current_profile_id()
    AND cr.status = 'active'
    AND cr.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND p.status <> 'anonymized';
$$;

COMMENT ON FUNCTION public.get_my_assigned_coach_profiles() IS
  'Returns limited coach profile fields for coaches actively assigned to the current coachee.';

REVOKE ALL ON FUNCTION public.get_my_assigned_coach_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_assigned_coach_profiles() TO authenticated;

-- -----------------------------------------------------------------------------
-- Organization timezone — RPC (preferred over broad organizations SELECT)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_organization_timezone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.default_timezone
  FROM public.profiles p
  INNER JOIN public.organizations o
    ON o.id = p.organization_id
  WHERE p.id = public.current_profile_id()
    AND p.deleted_at IS NULL
    AND p.status <> 'anonymized'
    AND p.organization_id IS NOT NULL
    AND o.deleted_at IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_organization_timezone() IS
  'Returns default_timezone for the current profile organization (single column).';

REVOKE ALL ON FUNCTION public.get_my_organization_timezone() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_organization_timezone() TO authenticated;

-- -----------------------------------------------------------------------------
-- organizations — RLS + super_admin admin (do NOT add all-active-org lookup)
-- -----------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_active_lookup ON public.organizations;
DROP POLICY IF EXISTS "member can read own organization timezone" ON public.organizations;

DROP POLICY IF EXISTS organizations_select_active_super_admin ON public.organizations;
CREATE POLICY organizations_select_active_super_admin
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_active_super_admin_profile());

DROP POLICY IF EXISTS organizations_write_active_super_admin ON public.organizations;
DROP POLICY IF EXISTS organizations_insert_active_super_admin ON public.organizations;
CREATE POLICY organizations_insert_active_super_admin
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_super_admin_profile());

DROP POLICY IF EXISTS organizations_update_active_super_admin ON public.organizations;
CREATE POLICY organizations_update_active_super_admin
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.is_active_super_admin_profile())
  WITH CHECK (public.is_active_super_admin_profile());

DROP POLICY IF EXISTS organizations_delete_active_super_admin ON public.organizations;
CREATE POLICY organizations_delete_active_super_admin
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (public.is_active_super_admin_profile());

-- Optional narrow member SELECT (fallback if RPC cannot be used in code yet).
-- Exposes full organization row to members — prefer get_my_organization_timezone().
DROP POLICY IF EXISTS organizations_select_member_own ON public.organizations;
CREATE POLICY organizations_select_member_own
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.current_profile_id()
        AND p.organization_id = public.organizations.id
        AND p.deleted_at IS NULL
        AND p.status <> 'anonymized'
    )
  );
