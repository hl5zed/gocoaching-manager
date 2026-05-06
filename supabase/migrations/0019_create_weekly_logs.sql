-- =============================================================================
-- Migration: 0019_create_weekly_logs.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the first weekly_logs table for coachee self-authored
--            weekly reflections tied to a coaching relationship.
--
-- Notes:
--   - This first version stores only a single weekly log record per
--     relationship and week_start.
--   - weekly_log_items is intentionally not created here.
--   - Reuses set_updated_at() from the existing migration baseline.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.coaching_relationships(id) ON DELETE RESTRICT,
  coachee_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  week_start date NOT NULL,
  week_end date NOT NULL,
  gratitude text NULL,
  prayer_request text NULL,
  progress_summary text NULL,
  difficulty text NULL,
  message_to_coach text NULL,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  submitted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'weekly_logs_status_chk'
  ) THEN
    ALTER TABLE public.weekly_logs
    ADD CONSTRAINT weekly_logs_status_chk
      CHECK (status IN ('draft', 'submitted', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_weekly_logs_relationship_id
  ON public.weekly_logs (relationship_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_logs_coachee_profile_id
  ON public.weekly_logs (coachee_profile_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_logs_week_start
  ON public.weekly_logs (week_start)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_logs_status
  ON public.weekly_logs (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_logs_deleted_at
  ON public.weekly_logs (deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_logs_relationship_week_start
  ON public.weekly_logs (relationship_id, week_start)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_weekly_logs_set_updated_at'
      AND tgrelid = 'public.weekly_logs'::regclass
  ) THEN
    CREATE TRIGGER trg_weekly_logs_set_updated_at
      BEFORE UPDATE ON public.weekly_logs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
