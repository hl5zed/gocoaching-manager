-- =============================================================================
-- Migration: 0039_create_spiritual_companion_tables.sql
-- Purpose:   Add private AI Spiritual Companion MVP tables with owner-only RLS.
--
-- Notes:
--   - Existing daily_records, weekly_logs, and monthly_reflections are unchanged.
--   - Ownership is based on public.profiles(id), resolved by public.current_profile_id().
--   - Deletes are intentionally modeled as soft deletes via deleted_at.
--   - No DELETE policies are added.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.spiritual_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  entry_date date NOT NULL,
  title text NULL,
  content text NOT NULL,
  mood text NULL,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT spiritual_entries_visibility_check CHECK (
    visibility = 'private'
  )
);

CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_text text NOT NULL,
  answered_text text NULL,
  status text NOT NULL DEFAULT 'open',
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT prayer_requests_status_check CHECK (
    status IN ('open', 'answered', 'archived')
  ),
  CONSTRAINT prayer_requests_visibility_check CHECK (
    visibility = 'private'
  )
);

CREATE TABLE IF NOT EXISTS public.ai_companion_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL,
  content text NOT NULL,
  provider text NOT NULL,
  model text NULL,
  input_tokens integer NULL,
  output_tokens integer NULL,
  user_local_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT ai_companion_messages_role_check CHECK (
    role IN ('user', 'assistant', 'system')
  ),
  CONSTRAINT ai_companion_messages_provider_check CHECK (
    provider IN ('openai', 'cloudflare', 'oci', 'mock')
  )
);

CREATE INDEX IF NOT EXISTS spiritual_entries_profile_entry_date_idx
  ON public.spiritual_entries (profile_id, entry_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS prayer_requests_profile_status_idx
  ON public.prayer_requests (profile_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ai_companion_messages_profile_local_date_created_idx
  ON public.ai_companion_messages (profile_id, user_local_date, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.spiritual_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_companion_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spiritual entries select own" ON public.spiritual_entries;
CREATE POLICY "spiritual entries select own"
ON public.spiritual_entries
FOR SELECT
TO authenticated
USING (
  public.spiritual_entries.deleted_at IS NULL
  AND public.spiritual_entries.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "spiritual entries insert own private" ON public.spiritual_entries;
CREATE POLICY "spiritual entries insert own private"
ON public.spiritual_entries
FOR INSERT
TO authenticated
WITH CHECK (
  public.spiritual_entries.profile_id = public.current_profile_id()
  AND public.spiritual_entries.visibility = 'private'
);

DROP POLICY IF EXISTS "spiritual entries update own private" ON public.spiritual_entries;
CREATE POLICY "spiritual entries update own private"
ON public.spiritual_entries
FOR UPDATE
TO authenticated
USING (
  public.spiritual_entries.deleted_at IS NULL
  AND public.spiritual_entries.profile_id = public.current_profile_id()
)
WITH CHECK (
  public.spiritual_entries.profile_id = public.current_profile_id()
  AND public.spiritual_entries.visibility = 'private'
);

DROP POLICY IF EXISTS "prayer requests select own" ON public.prayer_requests;
CREATE POLICY "prayer requests select own"
ON public.prayer_requests
FOR SELECT
TO authenticated
USING (
  public.prayer_requests.deleted_at IS NULL
  AND public.prayer_requests.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "prayer requests insert own private" ON public.prayer_requests;
CREATE POLICY "prayer requests insert own private"
ON public.prayer_requests
FOR INSERT
TO authenticated
WITH CHECK (
  public.prayer_requests.profile_id = public.current_profile_id()
  AND public.prayer_requests.visibility = 'private'
);

DROP POLICY IF EXISTS "prayer requests update own private" ON public.prayer_requests;
CREATE POLICY "prayer requests update own private"
ON public.prayer_requests
FOR UPDATE
TO authenticated
USING (
  public.prayer_requests.deleted_at IS NULL
  AND public.prayer_requests.profile_id = public.current_profile_id()
)
WITH CHECK (
  public.prayer_requests.profile_id = public.current_profile_id()
  AND public.prayer_requests.visibility = 'private'
);

DROP POLICY IF EXISTS "ai companion messages select own" ON public.ai_companion_messages;
CREATE POLICY "ai companion messages select own"
ON public.ai_companion_messages
FOR SELECT
TO authenticated
USING (
  public.ai_companion_messages.deleted_at IS NULL
  AND public.ai_companion_messages.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "ai companion messages insert own" ON public.ai_companion_messages;
CREATE POLICY "ai companion messages insert own"
ON public.ai_companion_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.ai_companion_messages.profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "ai companion messages update own" ON public.ai_companion_messages;
CREATE POLICY "ai companion messages update own"
ON public.ai_companion_messages
FOR UPDATE
TO authenticated
USING (
  public.ai_companion_messages.deleted_at IS NULL
  AND public.ai_companion_messages.profile_id = public.current_profile_id()
)
WITH CHECK (
  public.ai_companion_messages.profile_id = public.current_profile_id()
);
