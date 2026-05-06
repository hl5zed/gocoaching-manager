-- =============================================================================
-- Migration: 0018_create_coaching_relationships.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the first coaching_relationships table for coach workspace
--            read-only relationship listing and future relationship management.
--
-- Notes:
--   - References profiles(id) using explicit coach_profile_id /
--     coachee_profile_id column names.
--   - Uses CHECK constraints aligned with the shared TypeScript enum unions.
--   - Reuses set_updated_at() from 0002_create_languages.sql.
--   - Enables minimal SELECT RLS so authenticated coaches can read only
--     relationships directly tied to their own profile.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coaching_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  coachee_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  relationship_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coaching_relationships_distinct_profiles_chk'
  ) THEN
    ALTER TABLE public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_distinct_profiles_chk
      CHECK (coach_profile_id <> coachee_profile_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coaching_relationships_relationship_type_chk'
  ) THEN
    ALTER TABLE public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_relationship_type_chk
      CHECK (
        relationship_type IN (
          'individual_coaching',
          'group_coaching',
          'leadership_coaching',
          'pastoral_coaching',
          'missionary_coaching'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coaching_relationships_status_chk'
  ) THEN
    ALTER TABLE public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_status_chk
      CHECK (
        status IN (
          'active',
          'paused',
          'ended',
          'archived'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coaching_relationships_scope_type_chk'
  ) THEN
    ALTER TABLE public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_scope_type_chk
      CHECK (
        scope_type IN (
          'global',
          'country',
          'region',
          'organization',
          'church',
          'group',
          'cohort',
          'coach'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coaching_relationships_global_scope_chk'
  ) THEN
    ALTER TABLE public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_global_scope_chk
      CHECK (
        (scope_type = 'global' AND scope_id IS NULL)
        OR (scope_type <> 'global')
      );
  END IF;
END $$;

COMMENT ON TABLE public.coaching_relationships IS
  'Tracks direct coaching assignments between coach and coachee profiles.';

COMMENT ON COLUMN public.coaching_relationships.coach_profile_id IS
  'The coach profile in the relationship. References profiles(id).';

COMMENT ON COLUMN public.coaching_relationships.coachee_profile_id IS
  'The coachee profile in the relationship. References profiles(id).';

COMMENT ON COLUMN public.coaching_relationships.relationship_type IS
  'Relationship category such as individual_coaching or group_coaching.';

COMMENT ON COLUMN public.coaching_relationships.scope_type IS
  'Optional scope category for the relationship. global implies scope_id is null.';

CREATE INDEX IF NOT EXISTS idx_coaching_relationships_coach_profile_id
  ON public.coaching_relationships (coach_profile_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_relationships_coachee_profile_id
  ON public.coaching_relationships (coachee_profile_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_relationships_status
  ON public.coaching_relationships (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_relationships_deleted_at
  ON public.coaching_relationships (deleted_at);

CREATE INDEX IF NOT EXISTS idx_coaching_relationships_scope
  ON public.coaching_relationships (scope_type, scope_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_coaching_relationships_active_global
  ON public.coaching_relationships (
    coach_profile_id,
    coachee_profile_id,
    relationship_type,
    scope_type
  )
  WHERE deleted_at IS NULL
    AND status IN ('active', 'paused')
    AND scope_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_coaching_relationships_active_scoped
  ON public.coaching_relationships (
    coach_profile_id,
    coachee_profile_id,
    relationship_type,
    scope_type,
    scope_id
  )
  WHERE deleted_at IS NULL
    AND status IN ('active', 'paused')
    AND scope_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_coaching_relationships_set_updated_at'
      AND tgrelid = 'public.coaching_relationships'::regclass
  ) THEN
    CREATE TRIGGER trg_coaching_relationships_set_updated_at
      BEFORE UPDATE ON public.coaching_relationships
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE public.coaching_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_relationships FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coaching_relationships'
      AND policyname = 'coaching_relationships_select_own'
  ) THEN
    CREATE POLICY coaching_relationships_select_own
      ON public.coaching_relationships
      FOR SELECT
      TO authenticated
      USING (
        deleted_at IS NULL
        AND (
          coach_profile_id = get_current_profile_id()
          OR coachee_profile_id = get_current_profile_id()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coaching_relationships'
      AND policyname = 'coaching_relationships_select_super_admin'
  ) THEN
    CREATE POLICY coaching_relationships_select_super_admin
      ON public.coaching_relationships
      FOR SELECT
      TO authenticated
      USING (
        is_super_admin(get_current_profile_id())
      );
  END IF;
END $$;
