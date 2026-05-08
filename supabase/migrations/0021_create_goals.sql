CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  relationship_id uuid NULL REFERENCES public.coaching_relationships(id),
  title text NOT NULL,
  description text NULL,
  category text NULL,
  target_value numeric NULL,
  current_value numeric NULL DEFAULT 0,
  unit text NULL,
  status text NOT NULL DEFAULT 'active',
  priority text NOT NULL DEFAULT 'normal',
  start_date date NULL,
  due_date date NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS relationship_id uuid NULL REFERENCES public.coaching_relationships(id),
  ADD COLUMN IF NOT EXISTS category text NULL,
  ADD COLUMN IF NOT EXISTS current_value numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS start_date date NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'goals_status_check'
  ) THEN
    ALTER TABLE public.goals
    ADD CONSTRAINT goals_status_check
    CHECK (status IN ('active', 'paused', 'completed', 'archived'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'goals_priority_check'
  ) THEN
    ALTER TABLE public.goals
    ADD CONSTRAINT goals_priority_check
    CHECK (priority IN ('low', 'normal', 'high'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_goals_profile_id
  ON public.goals (profile_id);

CREATE INDEX IF NOT EXISTS idx_goals_relationship_id
  ON public.goals (relationship_id);

CREATE INDEX IF NOT EXISTS idx_goals_status
  ON public.goals (status);

CREATE INDEX IF NOT EXISTS idx_goals_priority
  ON public.goals (priority);

CREATE INDEX IF NOT EXISTS idx_goals_due_date
  ON public.goals (due_date);

CREATE INDEX IF NOT EXISTS idx_goals_deleted_at
  ON public.goals (deleted_at);
