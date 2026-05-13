-- =============================================================================
-- Migration: 0026_create_daily_records_monthly_reflections.sql
-- Project:   GOThriveCoaching
-- Purpose:   Add coachee-owned daily records and monthly reflections while
--            preserving the existing weekly_logs and moksilgi monthly flows.
--
-- Notes:
--   - weekly_logs, coach_feedback, and existing moksilgi tables are unchanged.
--   - App ownership is based on public.profiles(id), resolved by
--     public.current_profile_id().
--   - Deletes are intentionally modeled as soft deletes via deleted_at.
--   - Coach shared-read policies are intentionally deferred for a later step.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.daily_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  relationship_id uuid NULL REFERENCES public.coaching_relationships(id) ON DELETE SET NULL,
  record_date date NOT NULL,
  title text NULL,
  reflection text NULL,
  practice text NULL,
  prayer_request text NULL,
  visibility text NOT NULL DEFAULT 'private',
  shared_with_coach boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT daily_records_visibility_check CHECK (
    visibility IN ('private', 'coach')
  ),
  CONSTRAINT daily_records_status_check CHECK (
    status IN ('draft', 'submitted', 'reviewed')
  )
);

CREATE TABLE IF NOT EXISTS public.monthly_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  relationship_id uuid NULL REFERENCES public.coaching_relationships(id) ON DELETE SET NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  summary text NULL,
  growth_points text NULL,
  difficulty text NULL,
  next_month_plan text NULL,
  visibility text NOT NULL DEFAULT 'private',
  shared_with_coach boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT monthly_reflections_year_check CHECK (
    year BETWEEN 2000 AND 2100
  ),
  CONSTRAINT monthly_reflections_month_check CHECK (
    month BETWEEN 1 AND 12
  ),
  CONSTRAINT monthly_reflections_visibility_check CHECK (
    visibility IN ('private', 'coach')
  ),
  CONSTRAINT monthly_reflections_status_check CHECK (
    status IN ('draft', 'submitted', 'reviewed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_records_profile_record_date_unique
  ON public.daily_records (profile_id, record_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS daily_records_profile_id_idx
  ON public.daily_records (profile_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS daily_records_relationship_id_idx
  ON public.daily_records (relationship_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS daily_records_record_date_idx
  ON public.daily_records (record_date)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS daily_records_status_idx
  ON public.daily_records (status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS daily_records_visibility_idx
  ON public.daily_records (visibility)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS daily_records_shared_with_coach_idx
  ON public.daily_records (shared_with_coach)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS daily_records_deleted_at_idx
  ON public.daily_records (deleted_at);
CREATE INDEX IF NOT EXISTS daily_records_created_at_idx
  ON public.daily_records (created_at);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_reflections_profile_year_month_unique
  ON public.monthly_reflections (profile_id, year, month)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS monthly_reflections_profile_id_idx
  ON public.monthly_reflections (profile_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS monthly_reflections_relationship_id_idx
  ON public.monthly_reflections (relationship_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS monthly_reflections_year_idx
  ON public.monthly_reflections (year)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS monthly_reflections_month_idx
  ON public.monthly_reflections (month)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS monthly_reflections_status_idx
  ON public.monthly_reflections (status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS monthly_reflections_visibility_idx
  ON public.monthly_reflections (visibility)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS monthly_reflections_shared_with_coach_idx
  ON public.monthly_reflections (shared_with_coach)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS monthly_reflections_deleted_at_idx
  ON public.monthly_reflections (deleted_at);
CREATE INDEX IF NOT EXISTS monthly_reflections_created_at_idx
  ON public.monthly_reflections (created_at);

-- Reuse the project-wide set_updated_at() trigger function when it exists.
-- If it is unavailable in a target environment, create a records-specific fallback.
CREATE OR REPLACE FUNCTION public.set_personal_records_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_daily_records_set_updated_at'
      AND tgrelid = 'public.daily_records'::regclass
  ) THEN
    IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
      CREATE TRIGGER trg_daily_records_set_updated_at
        BEFORE UPDATE ON public.daily_records
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    ELSE
      CREATE TRIGGER trg_daily_records_set_updated_at
        BEFORE UPDATE ON public.daily_records
        FOR EACH ROW EXECUTE FUNCTION public.set_personal_records_updated_at();
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_monthly_reflections_set_updated_at'
      AND tgrelid = 'public.monthly_reflections'::regclass
  ) THEN
    IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
      CREATE TRIGGER trg_monthly_reflections_set_updated_at
        BEFORE UPDATE ON public.monthly_reflections
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    ELSE
      CREATE TRIGGER trg_monthly_reflections_set_updated_at
        BEFORE UPDATE ON public.monthly_reflections
        FOR EACH ROW EXECUTE FUNCTION public.set_personal_records_updated_at();
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reflections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_own_or_empty_relationship(
  p_relationship_id uuid,
  p_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_relationship_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.coaching_relationships cr
      WHERE cr.id = p_relationship_id
        AND cr.coachee_profile_id = p_profile_id
        AND cr.deleted_at IS NULL
    )
$$;

DROP POLICY IF EXISTS "daily records select own" ON public.daily_records;
CREATE POLICY "daily records select own"
ON public.daily_records
FOR SELECT
TO authenticated
USING (
  public.daily_records.deleted_at IS NULL
  AND public.daily_records.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "daily records insert own" ON public.daily_records;
CREATE POLICY "daily records insert own"
ON public.daily_records
FOR INSERT
TO authenticated
WITH CHECK (
  public.daily_records.profile_id = public.current_profile_id()
  AND public.is_own_or_empty_relationship(
    public.daily_records.relationship_id,
    public.daily_records.profile_id
  )
);

DROP POLICY IF EXISTS "daily records update own" ON public.daily_records;
CREATE POLICY "daily records update own"
ON public.daily_records
FOR UPDATE
TO authenticated
USING (
  public.daily_records.deleted_at IS NULL
  AND public.daily_records.profile_id = public.current_profile_id()
)
WITH CHECK (
  public.daily_records.profile_id = public.current_profile_id()
  AND public.is_own_or_empty_relationship(
    public.daily_records.relationship_id,
    public.daily_records.profile_id
  )
);

DROP POLICY IF EXISTS "monthly reflections select own" ON public.monthly_reflections;
CREATE POLICY "monthly reflections select own"
ON public.monthly_reflections
FOR SELECT
TO authenticated
USING (
  public.monthly_reflections.deleted_at IS NULL
  AND public.monthly_reflections.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "monthly reflections insert own" ON public.monthly_reflections;
CREATE POLICY "monthly reflections insert own"
ON public.monthly_reflections
FOR INSERT
TO authenticated
WITH CHECK (
  public.monthly_reflections.profile_id = public.current_profile_id()
  AND public.is_own_or_empty_relationship(
    public.monthly_reflections.relationship_id,
    public.monthly_reflections.profile_id
  )
);

DROP POLICY IF EXISTS "monthly reflections update own" ON public.monthly_reflections;
CREATE POLICY "monthly reflections update own"
ON public.monthly_reflections
FOR UPDATE
TO authenticated
USING (
  public.monthly_reflections.deleted_at IS NULL
  AND public.monthly_reflections.profile_id = public.current_profile_id()
)
WITH CHECK (
  public.monthly_reflections.profile_id = public.current_profile_id()
  AND public.is_own_or_empty_relationship(
    public.monthly_reflections.relationship_id,
    public.monthly_reflections.profile_id
  )
);
