-- =============================================================================
-- Migration: 0024_enable_rls_for_new_tables.sql
-- Project:   GOThriveCoaching
-- Purpose:   Enable RLS for newly added coaching, goals, feedback, and
--            moksilgi tables.
--
-- Notes:
--   - This migration is intentionally repeatable where PostgreSQL allows it.
--   - Existing app-level ownership checks must remain in place.
--   - Anonymous users receive no policies on these tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.status <> 'anonymized'
  LIMIT 1
$$;

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

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.coach_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moksilgi_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moksilgi_goal_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moksilgi_detail_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moksilgi_monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moksilgi_monthly_summaries ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- coach_feedback
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "coachee can read published own feedback" ON public.coach_feedback;
CREATE POLICY "coachee can read published own feedback"
ON public.coach_feedback
FOR SELECT
TO authenticated
USING (
  public.coach_feedback.deleted_at IS NULL
  AND public.coach_feedback.status = 'published'
  AND public.coach_feedback.coachee_profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "coach can read assigned weekly log feedback" ON public.coach_feedback;
CREATE POLICY "coach can read assigned weekly log feedback"
ON public.coach_feedback
FOR SELECT
TO authenticated
USING (
  public.coach_feedback.deleted_at IS NULL
  AND public.is_coach_for_weekly_log(public.coach_feedback.weekly_log_id)
);

DROP POLICY IF EXISTS "coach can insert assigned weekly log feedback" ON public.coach_feedback;
CREATE POLICY "coach can insert assigned weekly log feedback"
ON public.coach_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  public.coach_feedback.coach_profile_id = public.current_profile_id()
  AND public.is_coach_for_weekly_log(public.coach_feedback.weekly_log_id)
  AND EXISTS (
    SELECT 1
    FROM public.weekly_logs wl
    WHERE wl.id = public.coach_feedback.weekly_log_id
      AND wl.relationship_id = public.coach_feedback.relationship_id
      AND wl.coachee_profile_id = public.coach_feedback.coachee_profile_id
      AND wl.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coach can update own assigned weekly log feedback" ON public.coach_feedback;
CREATE POLICY "coach can update own assigned weekly log feedback"
ON public.coach_feedback
FOR UPDATE
TO authenticated
USING (
  public.coach_feedback.deleted_at IS NULL
  AND public.coach_feedback.coach_profile_id = public.current_profile_id()
  AND public.is_coach_for_weekly_log(public.coach_feedback.weekly_log_id)
)
WITH CHECK (
  public.coach_feedback.coach_profile_id = public.current_profile_id()
  AND public.is_coach_for_weekly_log(public.coach_feedback.weekly_log_id)
  AND EXISTS (
    SELECT 1
    FROM public.weekly_logs wl
    WHERE wl.id = public.coach_feedback.weekly_log_id
      AND wl.relationship_id = public.coach_feedback.relationship_id
      AND wl.coachee_profile_id = public.coach_feedback.coachee_profile_id
      AND wl.deleted_at IS NULL
  )
);

-- -----------------------------------------------------------------------------
-- goals
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "coachee can read own goals" ON public.goals;
CREATE POLICY "coachee can read own goals"
ON public.goals
FOR SELECT
TO authenticated
USING (
  public.goals.deleted_at IS NULL
  AND public.goals.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "coach can read assigned coachee goals" ON public.goals;
CREATE POLICY "coach can read assigned coachee goals"
ON public.goals
FOR SELECT
TO authenticated
USING (
  public.goals.deleted_at IS NULL
  AND public.is_coach_for_coachee(public.goals.profile_id)
);

DROP POLICY IF EXISTS "coachee can insert own goals" ON public.goals;
CREATE POLICY "coachee can insert own goals"
ON public.goals
FOR INSERT
TO authenticated
WITH CHECK (
  public.goals.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "coachee can update own goals" ON public.goals;
CREATE POLICY "coachee can update own goals"
ON public.goals
FOR UPDATE
TO authenticated
USING (
  public.goals.deleted_at IS NULL
  AND public.goals.profile_id = public.current_profile_id()
)
WITH CHECK (
  public.goals.profile_id = public.current_profile_id()
);

-- -----------------------------------------------------------------------------
-- moksilgi_plans
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "coachee can read own moksilgi plans" ON public.moksilgi_plans;
CREATE POLICY "coachee can read own moksilgi plans"
ON public.moksilgi_plans
FOR SELECT
TO authenticated
USING (
  public.moksilgi_plans.deleted_at IS NULL
  AND public.moksilgi_plans.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "coachee can insert own moksilgi plans" ON public.moksilgi_plans;
CREATE POLICY "coachee can insert own moksilgi plans"
ON public.moksilgi_plans
FOR INSERT
TO authenticated
WITH CHECK (
  public.moksilgi_plans.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "coachee can update own moksilgi plans" ON public.moksilgi_plans;
CREATE POLICY "coachee can update own moksilgi plans"
ON public.moksilgi_plans
FOR UPDATE
TO authenticated
USING (
  public.moksilgi_plans.deleted_at IS NULL
  AND public.moksilgi_plans.profile_id = public.current_profile_id()
)
WITH CHECK (
  public.moksilgi_plans.profile_id = public.current_profile_id()
);

-- -----------------------------------------------------------------------------
-- moksilgi_goal_areas
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "coachee can read own moksilgi goal areas" ON public.moksilgi_goal_areas;
CREATE POLICY "coachee can read own moksilgi goal areas"
ON public.moksilgi_goal_areas
FOR SELECT
TO authenticated
USING (
  public.moksilgi_goal_areas.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_goal_areas.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coachee can insert own moksilgi goal areas" ON public.moksilgi_goal_areas;
CREATE POLICY "coachee can insert own moksilgi goal areas"
ON public.moksilgi_goal_areas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_goal_areas.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coachee can update own moksilgi goal areas" ON public.moksilgi_goal_areas;
CREATE POLICY "coachee can update own moksilgi goal areas"
ON public.moksilgi_goal_areas
FOR UPDATE
TO authenticated
USING (
  public.moksilgi_goal_areas.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_goal_areas.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_goal_areas.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);

-- -----------------------------------------------------------------------------
-- moksilgi_detail_goals
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "coachee can read own moksilgi detail goals" ON public.moksilgi_detail_goals;
CREATE POLICY "coachee can read own moksilgi detail goals"
ON public.moksilgi_detail_goals
FOR SELECT
TO authenticated
USING (
  public.moksilgi_detail_goals.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_detail_goals.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coachee can insert own moksilgi detail goals" ON public.moksilgi_detail_goals;
CREATE POLICY "coachee can insert own moksilgi detail goals"
ON public.moksilgi_detail_goals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_detail_goals.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_goal_areas a
    WHERE a.id = public.moksilgi_detail_goals.area_id
      AND a.plan_id = public.moksilgi_detail_goals.plan_id
      AND a.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coachee can update own moksilgi detail goals" ON public.moksilgi_detail_goals;
CREATE POLICY "coachee can update own moksilgi detail goals"
ON public.moksilgi_detail_goals
FOR UPDATE
TO authenticated
USING (
  public.moksilgi_detail_goals.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_detail_goals.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_detail_goals.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_goal_areas a
    WHERE a.id = public.moksilgi_detail_goals.area_id
      AND a.plan_id = public.moksilgi_detail_goals.plan_id
      AND a.deleted_at IS NULL
  )
);

-- -----------------------------------------------------------------------------
-- moksilgi_monthly_records
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "coachee can read own moksilgi monthly records" ON public.moksilgi_monthly_records;
CREATE POLICY "coachee can read own moksilgi monthly records"
ON public.moksilgi_monthly_records
FOR SELECT
TO authenticated
USING (
  public.moksilgi_monthly_records.deleted_at IS NULL
  AND public.moksilgi_monthly_records.profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_monthly_records.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coachee can insert own moksilgi monthly records" ON public.moksilgi_monthly_records;
CREATE POLICY "coachee can insert own moksilgi monthly records"
ON public.moksilgi_monthly_records
FOR INSERT
TO authenticated
WITH CHECK (
  public.moksilgi_monthly_records.profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    JOIN public.moksilgi_goal_areas a
      ON a.plan_id = p.id
    JOIN public.moksilgi_detail_goals d
      ON d.plan_id = p.id
     AND d.area_id = a.id
    WHERE p.id = public.moksilgi_monthly_records.plan_id
      AND a.id = public.moksilgi_monthly_records.area_id
      AND d.id = public.moksilgi_monthly_records.detail_goal_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
      AND a.deleted_at IS NULL
      AND d.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coachee can update own moksilgi monthly records" ON public.moksilgi_monthly_records;
CREATE POLICY "coachee can update own moksilgi monthly records"
ON public.moksilgi_monthly_records
FOR UPDATE
TO authenticated
USING (
  public.moksilgi_monthly_records.deleted_at IS NULL
  AND public.moksilgi_monthly_records.profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_monthly_records.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
)
WITH CHECK (
  public.moksilgi_monthly_records.profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    JOIN public.moksilgi_goal_areas a
      ON a.plan_id = p.id
    JOIN public.moksilgi_detail_goals d
      ON d.plan_id = p.id
     AND d.area_id = a.id
    WHERE p.id = public.moksilgi_monthly_records.plan_id
      AND a.id = public.moksilgi_monthly_records.area_id
      AND d.id = public.moksilgi_monthly_records.detail_goal_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
      AND a.deleted_at IS NULL
      AND d.deleted_at IS NULL
  )
);

-- -----------------------------------------------------------------------------
-- moksilgi_monthly_summaries
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "coachee can read own moksilgi monthly summaries" ON public.moksilgi_monthly_summaries;
CREATE POLICY "coachee can read own moksilgi monthly summaries"
ON public.moksilgi_monthly_summaries
FOR SELECT
TO authenticated
USING (
  public.moksilgi_monthly_summaries.deleted_at IS NULL
  AND public.moksilgi_monthly_summaries.profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_monthly_summaries.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coachee can insert own moksilgi monthly summaries" ON public.moksilgi_monthly_summaries;
CREATE POLICY "coachee can insert own moksilgi monthly summaries"
ON public.moksilgi_monthly_summaries
FOR INSERT
TO authenticated
WITH CHECK (
  public.moksilgi_monthly_summaries.profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_monthly_summaries.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "coachee can update own moksilgi monthly summaries" ON public.moksilgi_monthly_summaries;
CREATE POLICY "coachee can update own moksilgi monthly summaries"
ON public.moksilgi_monthly_summaries
FOR UPDATE
TO authenticated
USING (
  public.moksilgi_monthly_summaries.deleted_at IS NULL
  AND public.moksilgi_monthly_summaries.profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_monthly_summaries.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
)
WITH CHECK (
  public.moksilgi_monthly_summaries.profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_monthly_summaries.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);
