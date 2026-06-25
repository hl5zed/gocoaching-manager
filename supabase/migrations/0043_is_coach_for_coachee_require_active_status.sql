-- =============================================================================
-- Migration: 0043_is_coach_for_coachee_require_active_status.sql
-- Project:   GOThriveCoaching
-- Purpose:   CRITICAL_REVIEW B1 — restrict coach RLS helpers to active
--            coaching_relationships only.
--
-- Business approval (2026-06):
--   - Coaches on ended/paused/archived relationships must NOT read coachee
--     goals or coach_feedback via RLS.
--   - Only status = 'active' grants coach access (paused treated like ended).
--
-- Scope:
--   - public.is_coach_for_coachee(uuid)
--   - public.is_coach_for_weekly_log(uuid)
--
-- Policies using these helpers (0024 goals, coach_feedback) pick up the
-- change automatically — no policy rewrites required.
--
-- Already aligned (no change):
--   - 0028 daily_records / monthly_reflections coach SELECT (cr.status = 'active')
--   - 0040 weekly_logs coach SELECT (cr.status = 'active')
--
-- Apply: staging Supabase SQL Editor first, then production after verification.
-- Rollback: docs/b1-0043-rollback.sql
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
      AND cr.status = 'active'
      AND cr.deleted_at IS NULL
  )
$$;

COMMENT ON FUNCTION public.is_coach_for_coachee(uuid) IS
  'True when current profile is the active (status=active) coach for the coachee.';

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
      AND cr.status = 'active'
      AND cr.coach_profile_id = public.current_profile_id()
  )
$$;

COMMENT ON FUNCTION public.is_coach_for_weekly_log(uuid) IS
  'True when current profile is the active coach for the weekly log relationship.';
