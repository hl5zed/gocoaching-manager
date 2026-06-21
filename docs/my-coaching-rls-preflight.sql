-- =============================================================================
-- My Coaching RLS — staging preflight checks
-- Run in Supabase SQL Editor (staging only) BEFORE applying 0040 migration.
-- Export all result sets for backup / audit.
-- =============================================================================

-- 1) Existing RLS policy backup
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'weekly_logs',
    'profiles',
    'organizations',
    'coaching_relationships',
    'coach_feedback'
  )
ORDER BY tablename, policyname;

-- 2) RLS enabled state
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('weekly_logs', 'profiles', 'organizations', 'coaching_relationships');

-- 3) Helper functions existence
SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'current_profile_id',
    'get_current_profile_id',
    'is_coach_for_coachee',
    'is_active_super_admin_profile',
    'weekly_log_has_active_coachee_relationship',
    'get_my_assigned_coach_profiles',
    'get_my_organization_timezone'
  )
ORDER BY proname;

-- 4) weekly_logs row counts
SELECT COUNT(*) AS total_rows FROM public.weekly_logs;
SELECT COUNT(*) AS active_rows FROM public.weekly_logs WHERE deleted_at IS NULL;
SELECT COUNT(*) AS soft_deleted_rows FROM public.weekly_logs WHERE deleted_at IS NOT NULL;

-- 5) coachee_profile_id null check (should be 0 — column is NOT NULL)
SELECT COUNT(*) AS null_coachee_profile_id
FROM public.weekly_logs
WHERE coachee_profile_id IS NULL;

-- 6) relationship mismatch / orphan weekly_logs
SELECT wl.id, wl.relationship_id, wl.coachee_profile_id, cr.coachee_profile_id AS cr_coachee
FROM public.weekly_logs wl
LEFT JOIN public.coaching_relationships cr ON cr.id = wl.relationship_id
WHERE wl.deleted_at IS NULL
  AND (
    cr.id IS NULL
    OR cr.coachee_profile_id <> wl.coachee_profile_id
    OR cr.deleted_at IS NOT NULL
  )
LIMIT 100;

-- 7) active relationship 없는 active weekly_logs
SELECT wl.id, wl.relationship_id, wl.coachee_profile_id, wl.status
FROM public.weekly_logs wl
LEFT JOIN public.coaching_relationships cr
  ON cr.id = wl.relationship_id
  AND cr.coachee_profile_id = wl.coachee_profile_id
  AND cr.status = 'active'
  AND cr.deleted_at IS NULL
WHERE wl.deleted_at IS NULL
  AND cr.id IS NULL
LIMIT 100;

-- 8) profiles ↔ coaching_relationships
SELECT COUNT(DISTINCT cr.coach_profile_id) AS distinct_coach_profiles
FROM public.coaching_relationships cr
WHERE cr.deleted_at IS NULL AND cr.status = 'active';

SELECT COUNT(*) AS orphan_coach_profile_refs
FROM public.coaching_relationships cr
LEFT JOIN public.profiles p
  ON p.id = cr.coach_profile_id AND p.deleted_at IS NULL
WHERE cr.deleted_at IS NULL AND p.id IS NULL;

-- 9) organizations ↔ profiles.organization_id
SELECT COUNT(*) AS profiles_with_org
FROM public.profiles
WHERE organization_id IS NOT NULL AND deleted_at IS NULL;

SELECT COUNT(*) AS broken_org_links
FROM public.profiles p
LEFT JOIN public.organizations o
  ON o.id = p.organization_id AND o.deleted_at IS NULL
WHERE p.organization_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND o.id IS NULL;

SELECT COUNT(*) AS profiles_needing_org_timezone_fallback
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND p.timezone IS NULL
  AND p.organization_id IS NOT NULL;

-- 10) Duplicate policy name collision check (0040 drops these)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (tablename = 'weekly_logs' AND policyname IN (
      'weekly_logs_select_own_coachee',
      'coachee can read own weekly logs',
      'weekly_logs_insert_own_coachee',
      'weekly_logs_update_own_coachee',
      'weekly_logs_select_assigned_coach_submitted',
      'weekly_logs_select_active_super_admin'
    ))
    OR (tablename = 'organizations' AND policyname IN (
      'organizations_select_active_lookup',
      'organizations_select_member_own',
      'member can read own organization timezone'
    ))
    OR (tablename = 'profiles' AND policyname = 'coachee can read assigned coach profiles')
  );
