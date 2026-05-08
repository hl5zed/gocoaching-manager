CREATE TABLE IF NOT EXISTS public.moksilgi_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL DEFAULT '목표와 실행전략 기획안',
  subtitle text NOT NULL DEFAULT '목실기와 체크리스트',
  period_start date NULL,
  period_end date NULL,
  written_at date NULL,
  author_name text NULL,
  region_name text NULL,
  team_name text NULL,
  regional_leader_name text NULL,
  coach_name text NULL,
  role_label text NULL,
  generation_label text NULL,
  mission_statement text NULL,
  mission_bible_verse text NULL,
  mission_description text NULL,
  vision_year integer NULL,
  vision_statement text NULL,
  vision_metrics text NULL,
  vision_target text NULL,
  vision_description text NULL,
  core_values_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  main_goal text NULL,
  main_goal_description text NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.moksilgi_goal_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.moksilgi_plans(id) ON DELETE CASCADE,
  area_key text NOT NULL,
  area_title text NOT NULL,
  area_subtitle text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.moksilgi_detail_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.moksilgi_plans(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.moksilgi_goal_areas(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  annual_target numeric NULL,
  monthly_target numeric NULL,
  unit text NULL,
  measurement_type text NOT NULL DEFAULT 'monthly_number',
  strategies_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moksilgi_plans_status_check'
  ) THEN
    ALTER TABLE public.moksilgi_plans
    ADD CONSTRAINT moksilgi_plans_status_check
    CHECK (status IN ('draft', 'active', 'archived'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moksilgi_goal_areas_area_key_check'
  ) THEN
    ALTER TABLE public.moksilgi_goal_areas
    ADD CONSTRAINT moksilgi_goal_areas_area_key_check
    CHECK (area_key IN ('spiritual', 'intellectual', 'physical', 'social', 'other'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moksilgi_detail_goals_measurement_type_check'
  ) THEN
    ALTER TABLE public.moksilgi_detail_goals
    ADD CONSTRAINT moksilgi_detail_goals_measurement_type_check
    CHECK (measurement_type IN ('daily_check', 'weekly_count', 'monthly_number', 'monthly_comment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_moksilgi_plans_profile_id
  ON public.moksilgi_plans (profile_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_plans_status
  ON public.moksilgi_plans (status);

CREATE INDEX IF NOT EXISTS idx_moksilgi_plans_period_start
  ON public.moksilgi_plans (period_start);

CREATE INDEX IF NOT EXISTS idx_moksilgi_plans_period_end
  ON public.moksilgi_plans (period_end);

CREATE INDEX IF NOT EXISTS idx_moksilgi_plans_deleted_at
  ON public.moksilgi_plans (deleted_at);

CREATE INDEX IF NOT EXISTS idx_moksilgi_goal_areas_plan_id
  ON public.moksilgi_goal_areas (plan_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_goal_areas_area_key
  ON public.moksilgi_goal_areas (area_key);

CREATE INDEX IF NOT EXISTS idx_moksilgi_goal_areas_sort_order
  ON public.moksilgi_goal_areas (sort_order);

CREATE INDEX IF NOT EXISTS idx_moksilgi_goal_areas_deleted_at
  ON public.moksilgi_goal_areas (deleted_at);

CREATE INDEX IF NOT EXISTS idx_moksilgi_detail_goals_plan_id
  ON public.moksilgi_detail_goals (plan_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_detail_goals_area_id
  ON public.moksilgi_detail_goals (area_id);

CREATE INDEX IF NOT EXISTS idx_moksilgi_detail_goals_measurement_type
  ON public.moksilgi_detail_goals (measurement_type);

CREATE INDEX IF NOT EXISTS idx_moksilgi_detail_goals_sort_order
  ON public.moksilgi_detail_goals (sort_order);

CREATE INDEX IF NOT EXISTS idx_moksilgi_detail_goals_deleted_at
  ON public.moksilgi_detail_goals (deleted_at);
