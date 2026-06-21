-- =============================================================================
-- My Coaching RLS — staging rollback for migration 0040
-- Run only on staging if 0040 causes regressions.
-- Does NOT drop foundation policies (profiles_select_own, etc.).
-- =============================================================================

-- weekly_logs policies (0040 + legacy suggestion names)
DROP POLICY IF EXISTS weekly_logs_select_own_coachee ON public.weekly_logs;
DROP POLICY IF EXISTS "coachee can read own weekly logs" ON public.weekly_logs;
DROP POLICY IF EXISTS weekly_logs_insert_own_coachee ON public.weekly_logs;
DROP POLICY IF EXISTS "coachee can insert own weekly logs" ON public.weekly_logs;
DROP POLICY IF EXISTS weekly_logs_update_own_coachee ON public.weekly_logs;
DROP POLICY IF EXISTS "coachee can update own weekly logs" ON public.weekly_logs;
DROP POLICY IF EXISTS weekly_logs_select_assigned_coach_submitted ON public.weekly_logs;
DROP POLICY IF EXISTS "coach can read assigned coachee weekly logs" ON public.weekly_logs;
DROP POLICY IF EXISTS weekly_logs_select_active_super_admin ON public.weekly_logs;

-- organizations policies (0040 only — re-create 0037 draft lookup manually if needed)
DROP POLICY IF EXISTS organizations_select_member_own ON public.organizations;
DROP POLICY IF EXISTS organizations_select_active_super_admin ON public.organizations;
DROP POLICY IF EXISTS organizations_insert_active_super_admin ON public.organizations;
DROP POLICY IF EXISTS organizations_update_active_super_admin ON public.organizations;
DROP POLICY IF EXISTS organizations_delete_active_super_admin ON public.organizations;
DROP POLICY IF EXISTS "member can read own organization timezone" ON public.organizations;

-- profiles suggestion policy (if applied separately)
DROP POLICY IF EXISTS "coachee can read assigned coach profiles" ON public.profiles;

-- RPCs (0040)
DROP FUNCTION IF EXISTS public.get_my_assigned_coach_profiles();
DROP FUNCTION IF EXISTS public.get_my_organization_timezone();

-- Helpers (0040)
DROP FUNCTION IF EXISTS public.weekly_log_has_active_coachee_relationship(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_active_super_admin_profile();

-- Last resort only — re-enables service_role-only access until policies restored:
-- ALTER TABLE public.weekly_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- After rollback: confirm my-coaching app still works via existing service_role paths.
