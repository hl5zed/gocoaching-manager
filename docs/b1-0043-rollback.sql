-- =============================================================================
-- CRITICAL_REVIEW B1 — rollback for migration 0043
-- Run on staging (or production) only if 0043 causes regressions.
--
-- Restores is_coach_for_coachee / is_coach_for_weekly_log to 0024 definitions
-- (no cr.status = 'active' filter).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_coach_for_coachee(p_coachee_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.coach_profile_id = public.current_profile_id()
      AND cr.coachee_profile_id = p_coachee_profile_id
      AND cr.deleted_at IS NULL
  )
$$;

COMMENT ON FUNCTION public.is_coach_for_coachee(uuid) IS
  'True when current profile is the coach for the coachee (0024 pre-0043).';

CREATE OR REPLACE FUNCTION public.is_coach_for_weekly_log(p_weekly_log_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.weekly_logs wl
    JOIN public.coaching_relationships cr
      ON cr.id = wl.relationship_id
    WHERE wl.id = p_weekly_log_id
      AND wl.deleted_at IS NULL
      AND cr.deleted_at IS NULL
      AND cr.coach_profile_id = public.current_profile_id()
  )
$$;

COMMENT ON FUNCTION public.is_coach_for_weekly_log(uuid) IS
  'True when current profile is the coach for the weekly log (0024 pre-0043).';
