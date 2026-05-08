-- =============================================================================
-- Migration: 0020_create_coach_feedback.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the first coach_feedback table for coach-authored
--            feedback on coachee weekly logs.
--
-- Notes:
--   - One non-deleted feedback row is allowed per weekly log and coach.
--   - This migration is intentionally idempotent for safe manual re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_log_id uuid NOT NULL REFERENCES public.weekly_logs(id) ON DELETE RESTRICT,
  relationship_id uuid NOT NULL REFERENCES public.coaching_relationships(id) ON DELETE RESTRICT,
  coach_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  coachee_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  feedback_text text NOT NULL,
  encouragement text NULL,
  next_step text NULL,
  status text NOT NULL DEFAULT 'published',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coach_feedback_status_chk'
  ) THEN
    ALTER TABLE public.coach_feedback
    ADD CONSTRAINT coach_feedback_status_chk
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coach_feedback_weekly_log_id
  ON public.coach_feedback (weekly_log_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coach_feedback_relationship_id
  ON public.coach_feedback (relationship_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coach_feedback_coach_profile_id
  ON public.coach_feedback (coach_profile_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coach_feedback_coachee_profile_id
  ON public.coach_feedback (coachee_profile_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coach_feedback_status
  ON public.coach_feedback (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coach_feedback_deleted_at
  ON public.coach_feedback (deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_coach_feedback_weekly_log_coach
  ON public.coach_feedback (weekly_log_id, coach_profile_id)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_coach_feedback_set_updated_at'
      AND tgrelid = 'public.coach_feedback'::regclass
  ) THEN
    CREATE TRIGGER trg_coach_feedback_set_updated_at
      BEFORE UPDATE ON public.coach_feedback
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
