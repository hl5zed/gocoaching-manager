-- =============================================================================
-- B1 / 0043 — staging post-apply verification
-- Run AFTER supabase/migrations/0043_is_coach_for_coachee_require_active_status.sql
-- Supabase SQL Editor — staging project ONLY
-- =============================================================================

-- 1) Function bodies include active filter
SELECT
  p.proname,
  pg_get_functiondef(p.oid) LIKE '%status = ''active''%' AS has_active_status_filter
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_coach_for_coachee', 'is_coach_for_weekly_log')
ORDER BY p.proname;

-- Expected: both rows has_active_status_filter = true

-- 2) Comments updated (0043 sets COMMENT ON FUNCTION)
SELECT
  p.proname,
  obj_description(p.oid, 'pg_proc') AS comment
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_coach_for_coachee', 'is_coach_for_weekly_log')
ORDER BY p.proname;

-- 3) Sanity: active relationship sample (replace UUIDs with staging test accounts)
-- Coach JWT required for RLS — use Dashboard "Run as user" or app login for full test.
-- Below is service-role / postgres read-only sizing only:

SELECT
  cr.id AS relationship_id,
  cr.status,
  cr.coach_profile_id,
  cr.coachee_profile_id
FROM public.coaching_relationships cr
WHERE cr.deleted_at IS NULL
ORDER BY cr.status, cr.updated_at DESC NULLS LAST
LIMIT 20;

-- PASS criteria (manual + SQL):
-- [ ] preflight exported
-- [ ] 0043 applied without error
-- [ ] both helpers has_active_status_filter = true
-- [ ] active coach: /coach/goals, feedback — still works (browser)
-- [ ] ended/paused coach: same coachee goals/feedback — blocked (browser)
-- [ ] coachee own data — unchanged
