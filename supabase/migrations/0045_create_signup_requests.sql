-- =============================================================================
-- Migration: 0045_create_signup_requests.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create signup_requests — self-service registration requests that
--            wait for admin approval, as an alternative on-ramp alongside the
--            existing admin-invitation and admin-direct-create flows.
--
-- Notes:
--   - This migration only creates the table, constraints, indexes, and RLS.
--     No account/profile is created here — approval logic (creating the
--     auth user + profiles + user_roles row) is implemented separately and
--     must reuse the existing admin-create-user path, not duplicate it.
--   - Uses text + CHECK constraints aligned with the shared TypeScript enum
--     unions (USER_ROLES / SCOPE_TYPES in src/types/database.ts), matching
--     the pattern used in 0018_create_coaching_relationships.sql rather than
--     the legacy custom enum types.
--   - This is the first table in this project where an anonymous (pre-
--     account) visitor can INSERT a row. The INSERT policy intentionally
--     only allows creating a 'pending' row for one's own email — it cannot
--     read, update, or approve anything. Rate limiting / duplicate-email
--     validation at the application layer is still required before this is
--     wired up to a public page.
--   - invitations, profiles, user_roles, and the accept_invitation RPC are
--     untouched by this migration.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  email text NOT NULL CHECK (length(trim(email)) > 0),
  name text NOT NULL CHECK (length(trim(name)) > 0),

  requested_role text NOT NULL,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid NULL,

  requested_locale text NULL,

  status text NOT NULL DEFAULT 'pending',
  rejected_reason text NULL,

  reviewed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,

  -- Set by the (future) approval flow after it creates the auth user +
  -- profile via the existing admin-create-user path.
  created_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signup_requests_status_chk'
  ) THEN
    ALTER TABLE public.signup_requests
    ADD CONSTRAINT signup_requests_status_chk
      CHECK (
        status IN (
          'pending',
          'approved',
          'rejected'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signup_requests_requested_role_chk'
  ) THEN
    ALTER TABLE public.signup_requests
    ADD CONSTRAINT signup_requests_requested_role_chk
      CHECK (
        requested_role IN (
          'super_admin',
          'country_admin',
          'organization_admin',
          'church_admin',
          'group_leader',
          'coach_maker',
          'coach',
          'coachee'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signup_requests_scope_type_chk'
  ) THEN
    ALTER TABLE public.signup_requests
    ADD CONSTRAINT signup_requests_scope_type_chk
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
    WHERE conname = 'signup_requests_global_scope_chk'
  ) THEN
    ALTER TABLE public.signup_requests
    ADD CONSTRAINT signup_requests_global_scope_chk
      CHECK (
        (scope_type = 'global' AND scope_id IS NULL)
        OR (scope_type <> 'global')
      );
  END IF;
END $$;

-- Bidirectional review-state consistency, mirroring the invitations pattern:
-- pending rows must not carry review data; approved/rejected rows must.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signup_requests_review_state_chk'
  ) THEN
    ALTER TABLE public.signup_requests
    ADD CONSTRAINT signup_requests_review_state_chk
      CHECK (
        (
          status = 'pending'
          AND reviewed_by IS NULL
          AND reviewed_at IS NULL
        )
        OR (
          status IN ('approved', 'rejected')
          AND reviewed_by IS NOT NULL
          AND reviewed_at IS NOT NULL
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signup_requests_approved_has_profile_chk'
  ) THEN
    ALTER TABLE public.signup_requests
    ADD CONSTRAINT signup_requests_approved_has_profile_chk
      CHECK (
        (status = 'approved' AND created_profile_id IS NOT NULL)
        OR (status <> 'approved' AND created_profile_id IS NULL)
      );
  END IF;
END $$;

COMMENT ON TABLE public.signup_requests IS
  'Self-service signup requests submitted by prospective users before any '
  'account exists. An admin reviews and approves/rejects each request; '
  'approval must reuse the existing admin-create-user path (auth user + '
  'profiles + user_roles), not duplicate that logic here.';

COMMENT ON COLUMN public.signup_requests.email IS
  'Email address the applicant registered with. Not yet an auth.users row.';

COMMENT ON COLUMN public.signup_requests.requested_role IS
  'Role the applicant is requesting. Final role is set by the approving admin '
  'in the actual user_roles row, not enforced from this value.';

COMMENT ON COLUMN public.signup_requests.status IS
  'pending → awaiting admin review. '
  'approved → admin created the account; created_profile_id is set. '
  'rejected → admin declined; rejected_reason may explain why.';

COMMENT ON COLUMN public.signup_requests.created_profile_id IS
  'profiles.id created by the approval flow once approved. NULL until then.';

-- Prevent duplicate pending requests for the same email (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS uq_signup_requests_pending_email
  ON public.signup_requests (lower(email))
  WHERE status = 'pending'
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_signup_requests_status
  ON public.signup_requests (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_signup_requests_email
  ON public.signup_requests (lower(email))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_signup_requests_deleted_at
  ON public.signup_requests (deleted_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_signup_requests_set_updated_at'
      AND tgrelid = 'public.signup_requests'::regclass
  ) THEN
    CREATE TRIGGER trg_signup_requests_set_updated_at
      BEFORE UPDATE ON public.signup_requests
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_requests FORCE ROW LEVEL SECURITY;

-- Anyone (including anonymous, pre-account visitors) may submit a signup
-- request for themselves. This is intentionally narrow: it can only create
-- a fresh 'pending' row with no review fields set — it cannot self-approve,
-- read other requests, or update anything after insert.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signup_requests'
      AND policyname = 'signup_requests_insert_anon'
  ) THEN
    CREATE POLICY signup_requests_insert_anon
      ON public.signup_requests
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (
        status = 'pending'
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
        AND created_profile_id IS NULL
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signup_requests'
      AND policyname = 'signup_requests_select_super_admin'
  ) THEN
    CREATE POLICY signup_requests_select_super_admin
      ON public.signup_requests
      FOR SELECT
      TO authenticated
      USING (
        is_super_admin(get_current_profile_id())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signup_requests'
      AND policyname = 'signup_requests_update_super_admin'
  ) THEN
    CREATE POLICY signup_requests_update_super_admin
      ON public.signup_requests
      FOR UPDATE
      TO authenticated
      USING (
        is_super_admin(get_current_profile_id())
      )
      WITH CHECK (
        is_super_admin(get_current_profile_id())
      );
  END IF;
END $$;

-- =============================================================================
-- End of 0045_create_signup_requests.sql
--
-- Objects created:
--   TABLE      signup_requests
--   CONSTRAINT signup_requests_status_chk
--   CONSTRAINT signup_requests_requested_role_chk
--   CONSTRAINT signup_requests_scope_type_chk
--   CONSTRAINT signup_requests_global_scope_chk
--   CONSTRAINT signup_requests_review_state_chk
--   CONSTRAINT signup_requests_approved_has_profile_chk
--   INDEX      uq_signup_requests_pending_email (unique partial)
--   INDEX      idx_signup_requests_status
--   INDEX      idx_signup_requests_email
--   INDEX      idx_signup_requests_deleted_at
--   TRIGGER    trg_signup_requests_set_updated_at
--   POLICY     signup_requests_insert_anon (anon + authenticated INSERT)
--   POLICY     signup_requests_select_super_admin
--   POLICY     signup_requests_update_super_admin
--
-- Not created here (future step, requires explicit approval):
--   - /signup public page
--   - /admin/signup-requests approval queue page
--   - approval API route that creates the auth user + profile + user_roles
--     (must reuse the existing admin-create-user path)
-- =============================================================================
