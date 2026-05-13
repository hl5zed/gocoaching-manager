-- =============================================================================
-- Migration: 0028_add_shared_record_coach_select_policies.sql
-- Project:   GOThriveCoaching
-- Purpose:   Allow assigned coaches to read only shared daily records and
--            monthly reflections from their active coachees.
--
-- Notes:
--   - Ownership remains based on public.current_profile_id(), not auth.uid().
--   - This migration only adds SELECT policies.
--   - It does not grant coaches, coach_makers, or admins write access to record
--     bodies.
-- =============================================================================

CREATE POLICY daily_records_select_shared_for_assigned_coach
ON public.daily_records
FOR SELECT
TO authenticated
USING (
  public.daily_records.deleted_at IS NULL
  AND public.daily_records.shared_with_coach = true
  AND public.daily_records.visibility = 'coach'
  AND EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.coachee_profile_id = public.daily_records.profile_id
      AND cr.coach_profile_id = public.current_profile_id()
      AND cr.status = 'active'
      AND cr.deleted_at IS NULL
      AND (
        public.daily_records.relationship_id IS NULL
        OR public.daily_records.relationship_id = cr.id
      )
  )
);

CREATE POLICY monthly_reflections_select_shared_for_assigned_coach
ON public.monthly_reflections
FOR SELECT
TO authenticated
USING (
  public.monthly_reflections.deleted_at IS NULL
  AND public.monthly_reflections.shared_with_coach = true
  AND public.monthly_reflections.visibility = 'coach'
  AND EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.coachee_profile_id = public.monthly_reflections.profile_id
      AND cr.coach_profile_id = public.current_profile_id()
      AND cr.status = 'active'
      AND cr.deleted_at IS NULL
      AND (
        public.monthly_reflections.relationship_id IS NULL
        OR public.monthly_reflections.relationship_id = cr.id
      )
  )
);
