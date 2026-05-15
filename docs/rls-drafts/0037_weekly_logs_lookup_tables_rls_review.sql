-- =============================================================================
-- Migration: 0037_add_rls_policies_for_weekly_logs_and_lookup_tables.sql
-- Project:   GO Coaching Manager
-- Purpose:   Add first-pass RLS policies for weekly_logs and lookup tables.
--
-- Notes:
--   - Review-only migration: write the SQL for review before applying to DB.
--   - Does not touch profiles, user_roles, invitations, system_settings,
--     system_announcements, or weekly_log_items.
--   - Reuses public.current_profile_id() from 0024.
--   - Super admin checks follow the active profile/user_roles pattern already
--     used by system_settings and system_announcements policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- weekly_logs
-- -----------------------------------------------------------------------------

ALTER TABLE public.weekly_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_logs_select_own_coachee ON public.weekly_logs;
CREATE POLICY weekly_logs_select_own_coachee
  ON public.weekly_logs
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND coachee_profile_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS weekly_logs_insert_own_coachee ON public.weekly_logs;
CREATE POLICY weekly_logs_insert_own_coachee
  ON public.weekly_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND coachee_profile_id = public.current_profile_id()
    AND status IN ('draft', 'submitted')
    AND EXISTS (
      SELECT 1
      FROM public.coaching_relationships cr
      WHERE cr.id = public.weekly_logs.relationship_id
        AND cr.coachee_profile_id = public.current_profile_id()
        AND cr.coachee_profile_id = public.weekly_logs.coachee_profile_id
        AND cr.status = 'active'
        AND cr.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS weekly_logs_update_own_coachee ON public.weekly_logs;
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
    deleted_at IS NULL
    AND coachee_profile_id = public.current_profile_id()
    AND status <> 'archived'
    AND EXISTS (
      SELECT 1
      FROM public.coaching_relationships cr
      WHERE cr.id = public.weekly_logs.relationship_id
        AND cr.coachee_profile_id = public.current_profile_id()
        AND cr.coachee_profile_id = public.weekly_logs.coachee_profile_id
        AND cr.status = 'active'
        AND cr.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS weekly_logs_select_assigned_coach_submitted ON public.weekly_logs;
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
  USING (
    EXISTS (
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
    )
  );

-- Intentionally no weekly_logs DELETE policy.
-- Coach feedback must continue through the existing coach_feedback/API flow, not
-- direct weekly_logs body updates.

-- -----------------------------------------------------------------------------
-- countries
-- -----------------------------------------------------------------------------

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS countries_select_active_lookup ON public.countries;
CREATE POLICY countries_select_active_lookup
  ON public.countries
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS countries_write_active_super_admin ON public.countries;
DROP POLICY IF EXISTS countries_insert_active_super_admin ON public.countries;
CREATE POLICY countries_insert_active_super_admin
  ON public.countries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS countries_update_active_super_admin ON public.countries;
CREATE POLICY countries_update_active_super_admin
  ON public.countries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
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
    )
  )
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS countries_delete_active_super_admin ON public.countries;
CREATE POLICY countries_delete_active_super_admin
  ON public.countries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
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
    )
  );

-- -----------------------------------------------------------------------------
-- regions
-- -----------------------------------------------------------------------------

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regions_select_authenticated_lookup ON public.regions;
CREATE POLICY regions_select_authenticated_lookup
  ON public.regions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS regions_write_active_super_admin ON public.regions;
DROP POLICY IF EXISTS regions_insert_active_super_admin ON public.regions;
CREATE POLICY regions_insert_active_super_admin
  ON public.regions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS regions_update_active_super_admin ON public.regions;
CREATE POLICY regions_update_active_super_admin
  ON public.regions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
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
    )
  )
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS regions_delete_active_super_admin ON public.regions;
CREATE POLICY regions_delete_active_super_admin
  ON public.regions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
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
    )
  );

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_active_lookup ON public.organizations;
CREATE POLICY organizations_select_active_lookup
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS organizations_write_active_super_admin ON public.organizations;
DROP POLICY IF EXISTS organizations_insert_active_super_admin ON public.organizations;
CREATE POLICY organizations_insert_active_super_admin
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS organizations_update_active_super_admin ON public.organizations;
CREATE POLICY organizations_update_active_super_admin
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
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
    )
  )
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS organizations_delete_active_super_admin ON public.organizations;
CREATE POLICY organizations_delete_active_super_admin
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
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
    )
  );

-- -----------------------------------------------------------------------------
-- churches
-- -----------------------------------------------------------------------------

ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS churches_select_authenticated_lookup ON public.churches;
CREATE POLICY churches_select_authenticated_lookup
  ON public.churches
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS churches_write_active_super_admin ON public.churches;
DROP POLICY IF EXISTS churches_insert_active_super_admin ON public.churches;
CREATE POLICY churches_insert_active_super_admin
  ON public.churches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS churches_update_active_super_admin ON public.churches;
CREATE POLICY churches_update_active_super_admin
  ON public.churches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
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
    )
  )
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS churches_delete_active_super_admin ON public.churches;
CREATE POLICY churches_delete_active_super_admin
  ON public.churches
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
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
    )
  );

-- -----------------------------------------------------------------------------
-- groups
-- -----------------------------------------------------------------------------

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS groups_select_authenticated_lookup ON public.groups;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'groups'
      AND column_name = 'deleted_at'
  ) THEN
    EXECUTE '
      CREATE POLICY groups_select_authenticated_lookup
        ON public.groups
        FOR SELECT
        TO authenticated
        USING (deleted_at IS NULL)
    ';
  ELSE
    EXECUTE '
      CREATE POLICY groups_select_authenticated_lookup
        ON public.groups
        FOR SELECT
        TO authenticated
        USING (true)
    ';
  END IF;
END $$;

DROP POLICY IF EXISTS groups_write_active_super_admin ON public.groups;
DROP POLICY IF EXISTS groups_insert_active_super_admin ON public.groups;
CREATE POLICY groups_insert_active_super_admin
  ON public.groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS groups_update_active_super_admin ON public.groups;
CREATE POLICY groups_update_active_super_admin
  ON public.groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
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
    )
  )
  WITH CHECK (
    EXISTS (
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
    )
  );

DROP POLICY IF EXISTS groups_delete_active_super_admin ON public.groups;
CREATE POLICY groups_delete_active_super_admin
  ON public.groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
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
    )
  );
