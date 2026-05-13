-- =============================================================================
-- Migration: 0025_create_coach_action_notes.sql
-- Project:   GOThriveCoaching
-- Purpose:   Add coach-maker management action notes table and RLS policies.
--
-- Notes:
--   - This migration creates only a new table and policies for that table.
--   - Existing tables, existing policies, and existing auth flows are unchanged.
--   - Deletes are intentionally implemented as soft delete updates via deleted_at.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_action_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  church_id uuid NULL REFERENCES public.churches(id) ON DELETE SET NULL,
  coach_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_name text NOT NULL,
  team_id uuid NULL,
  team_name text NULL,
  region text NULL,
  action_type text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  note text NOT NULL,
  due_date date NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  deleted_at timestamptz NULL,
  CONSTRAINT coach_action_notes_target_type_check CHECK (
    target_type IN (
      'coach',
      'team',
      'attention_target',
      'coachee',
      'church',
      'organization'
    )
  ),
  CONSTRAINT coach_action_notes_action_type_check CHECK (
    action_type IN (
      'contact_line',
      'coaching_encouragement',
      'team_leader_check',
      'next_meeting_check',
      'other'
    )
  ),
  CONSTRAINT coach_action_notes_priority_check CHECK (
    priority IN ('low', 'normal', 'high')
  ),
  CONSTRAINT coach_action_notes_status_check CHECK (
    status IN ('open', 'in_progress', 'completed', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS coach_action_notes_organization_id_idx
  ON public.coach_action_notes (organization_id);
CREATE INDEX IF NOT EXISTS coach_action_notes_church_id_idx
  ON public.coach_action_notes (church_id);
CREATE INDEX IF NOT EXISTS coach_action_notes_coach_id_idx
  ON public.coach_action_notes (coach_id);
CREATE INDEX IF NOT EXISTS coach_action_notes_target_user_id_idx
  ON public.coach_action_notes (target_user_id);
CREATE INDEX IF NOT EXISTS coach_action_notes_target_type_idx
  ON public.coach_action_notes (target_type);
CREATE INDEX IF NOT EXISTS coach_action_notes_status_idx
  ON public.coach_action_notes (status);
CREATE INDEX IF NOT EXISTS coach_action_notes_priority_idx
  ON public.coach_action_notes (priority);
CREATE INDEX IF NOT EXISTS coach_action_notes_created_by_idx
  ON public.coach_action_notes (created_by);
CREATE INDEX IF NOT EXISTS coach_action_notes_created_at_idx
  ON public.coach_action_notes (created_at);
CREATE INDEX IF NOT EXISTS coach_action_notes_deleted_at_idx
  ON public.coach_action_notes (deleted_at);

-- Reuse the project-wide set_updated_at() trigger function when it exists.
-- If it is unavailable in a target environment, create a table-specific fallback.
CREATE OR REPLACE FUNCTION public.set_coach_action_notes_updated_at()
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
    WHERE tgname = 'trg_coach_action_notes_set_updated_at'
      AND tgrelid = 'public.coach_action_notes'::regclass
  ) THEN
    IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
      CREATE TRIGGER trg_coach_action_notes_set_updated_at
        BEFORE UPDATE ON public.coach_action_notes
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    ELSE
      CREATE TRIGGER trg_coach_action_notes_set_updated_at
        BEFORE UPDATE ON public.coach_action_notes
        FOR EACH ROW EXECUTE FUNCTION public.set_coach_action_notes_updated_at();
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS helpers scoped to coach_action_notes.
-- These helpers intentionally reuse public.current_profile_id() from 0024.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_active_role(p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.profile_id = public.current_profile_id()
      AND ur.role::text = ANY (p_roles)
      AND ur.status = 'active'
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_coach_action_note_scope(
  p_organization_id uuid,
  p_church_id uuid,
  p_created_by uuid,
  p_coach_id uuid,
  p_target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_active_role(ARRAY['super_admin'])
    OR (
      public.has_active_role(ARRAY['organization_admin'])
      AND p_organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.profile_id = public.current_profile_id()
          AND ur.role::text = 'organization_admin'
          AND ur.scope_type = 'organization'
          AND ur.scope_id = p_organization_id
          AND ur.status = 'active'
          AND ur.is_active = true
          AND ur.deleted_at IS NULL
          AND (ur.expires_at IS NULL OR ur.expires_at > now())
      )
    )
    OR (
      public.has_active_role(ARRAY['church_admin'])
      AND p_church_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.profile_id = public.current_profile_id()
          AND ur.role::text = 'church_admin'
          AND ur.scope_type = 'church'
          AND ur.scope_id = p_church_id
          AND ur.status = 'active'
          AND ur.is_active = true
          AND ur.deleted_at IS NULL
          AND (ur.expires_at IS NULL OR ur.expires_at > now())
      )
    )
    OR (
      public.has_active_role(ARRAY['coach_maker'])
      AND (
        p_created_by = public.current_profile_id()
        OR p_coach_id = public.current_profile_id()
        OR p_target_user_id = public.current_profile_id()
        OR (
          p_target_user_id IS NOT NULL
          AND public.is_coach_for_coachee(p_target_user_id)
        )
      )
    )
$$;

ALTER TABLE public.coach_action_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach action notes select allowed scope" ON public.coach_action_notes;
CREATE POLICY "coach action notes select allowed scope"
ON public.coach_action_notes
FOR SELECT
TO authenticated
USING (
  public.coach_action_notes.deleted_at IS NULL
  AND (
    public.can_access_coach_action_note_scope(
      public.coach_action_notes.organization_id,
      public.coach_action_notes.church_id,
      public.coach_action_notes.created_by,
      public.coach_action_notes.coach_id,
      public.coach_action_notes.target_user_id
    )
    OR (
      public.has_active_role(ARRAY['coach'])
      AND public.coach_action_notes.created_by = public.current_profile_id()
    )
  )
);

DROP POLICY IF EXISTS "coach action notes insert allowed managers" ON public.coach_action_notes;
CREATE POLICY "coach action notes insert allowed managers"
ON public.coach_action_notes
FOR INSERT
TO authenticated
WITH CHECK (
  public.coach_action_notes.created_by = public.current_profile_id()
  AND public.has_active_role(
    ARRAY[
      'coach_maker',
      'church_admin',
      'organization_admin',
      'super_admin'
    ]
  )
  AND public.can_access_coach_action_note_scope(
    public.coach_action_notes.organization_id,
    public.coach_action_notes.church_id,
    public.coach_action_notes.created_by,
    public.coach_action_notes.coach_id,
    public.coach_action_notes.target_user_id
  )
);

DROP POLICY IF EXISTS "coach action notes update allowed managers" ON public.coach_action_notes;
CREATE POLICY "coach action notes update allowed managers"
ON public.coach_action_notes
FOR UPDATE
TO authenticated
USING (
  public.coach_action_notes.deleted_at IS NULL
  AND public.has_active_role(
    ARRAY[
      'coach_maker',
      'church_admin',
      'organization_admin',
      'super_admin'
    ]
  )
  AND public.can_access_coach_action_note_scope(
    public.coach_action_notes.organization_id,
    public.coach_action_notes.church_id,
    public.coach_action_notes.created_by,
    public.coach_action_notes.coach_id,
    public.coach_action_notes.target_user_id
  )
)
WITH CHECK (
  public.has_active_role(
    ARRAY[
      'coach_maker',
      'church_admin',
      'organization_admin',
      'super_admin'
    ]
  )
  AND public.can_access_coach_action_note_scope(
    public.coach_action_notes.organization_id,
    public.coach_action_notes.church_id,
    public.coach_action_notes.created_by,
    public.coach_action_notes.coach_id,
    public.coach_action_notes.target_user_id
  )
);

-- No DELETE policy: removing notes should be done by UPDATE deleted_at.
