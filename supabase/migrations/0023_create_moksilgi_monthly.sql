CREATE TABLE IF NOT EXISTS public.moksilgi_monthly_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.moksilgi_plans(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.moksilgi_goal_areas(id) ON DELETE CASCADE,
  detail_goal_id uuid NOT NULL REFERENCES public.moksilgi_detail_goals(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  year integer NOT NULL,
  month integer NOT NULL,
  target_value numeric NULL,
  actual_value numeric NULL,
  achievement_rate numeric NOT NULL DEFAULT 0,
  daily_checks_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  weekly_counts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.moksilgi_monthly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.moksilgi_plans(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  year integer NOT NULL,
  month integer NOT NULL,
  spiritual_rate numeric NOT NULL DEFAULT 0,
  intellectual_rate numeric NOT NULL DEFAULT 0,
  physical_rate numeric NOT NULL DEFAULT 0,
  social_rate numeric NOT NULL DEFAULT 0,
  other_rate numeric NOT NULL DEFAULT 0,
  total_rate numeric NOT NULL DEFAULT 0,
  average_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moksilgi_monthly_records_year_check'
  ) THEN
    ALTER TABLE public.moksilgi_monthly_records
    ADD CONSTRAINT moksilgi_monthly_records_year_check
    CHECK (year BETWEEN 2000 AND 2100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moksilgi_monthly_records_month_check'
  ) THEN
    ALTER TABLE public.moksilgi_monthly_records
    ADD CONSTRAINT moksilgi_monthly_records_month_check
    CHECK (month BETWEEN 1 AND 12);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moksilgi_monthly_summaries_year_check'
  ) THEN
    ALTER TABLE public.moksilgi_monthly_summaries
    ADD CONSTRAINT moksilgi_monthly_summaries_year_check
    CHECK (year BETWEEN 2000 AND 2100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moksilgi_monthly_summaries_month_check'
  ) THEN
    ALTER TABLE public.moksilgi_monthly_summaries
    ADD CONSTRAINT moksilgi_monthly_summaries_month_check
    CHECK (month BETWEEN 1 AND 12);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS moksilgi_monthly_records_unique_active
  ON public.moksilgi_monthly_records (detail_goal_id, year, month)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS moksilgi_monthly_summaries_unique_active
  ON public.moksilgi_monthly_summaries (plan_id, year, month)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_records_profile_id
  ON public.moksilgi_monthly_records (profile_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_records_plan_id
  ON public.moksilgi_monthly_records (plan_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_records_area_id
  ON public.moksilgi_monthly_records (area_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_records_detail_goal_id
  ON public.moksilgi_monthly_records (detail_goal_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_records_year
  ON public.moksilgi_monthly_records (year);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_records_month
  ON public.moksilgi_monthly_records (month);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_records_deleted_at
  ON public.moksilgi_monthly_records (deleted_at);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_summaries_profile_id
  ON public.moksilgi_monthly_summaries (profile_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_summaries_plan_id
  ON public.moksilgi_monthly_summaries (plan_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_summaries_year
  ON public.moksilgi_monthly_summaries (year);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_summaries_month
  ON public.moksilgi_monthly_summaries (month);

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_summaries_deleted_at
  ON public.moksilgi_monthly_summaries (deleted_at);
