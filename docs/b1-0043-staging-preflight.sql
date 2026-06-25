-- =============================================================================
-- B1 / 0043 — staging preflight (run BEFORE applying 0043)
-- Supabase SQL Editor — staging project ONLY
-- =============================================================================

-- 1) Confirm helpers exist
SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('is_coach_for_coachee', 'is_coach_for_weekly_log', 'current_profile_id')
ORDER BY proname;

-- 2) Already applied? (0043 adds cr.status = 'active' in function body)
SELECT
  p.proname,
  pg_get_functiondef(p.oid) LIKE '%status = ''active''%' AS has_active_status_filter
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_coach_for_coachee', 'is_coach_for_weekly_log')
ORDER BY p.proname;

-- Expected BEFORE apply: has_active_status_filter = false for both (0024 baseline)
-- Expected AFTER apply:  has_active_status_filter = true for both

-- 3) Relationship status distribution (impact sizing)
SELECT status, COUNT(*) AS relationship_count
FROM public.coaching_relationships
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- 4) Non-active relationships with goals (coaches who will lose RLS access after 0043)
SELECT cr.status, COUNT(DISTINCT cr.id) AS relationships, COUNT(g.id) AS goal_rows
FROM public.coaching_relationships cr
JOIN public.goals g
  ON g.profile_id = cr.coachee_profile_id
 AND g.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND cr.status <> 'active'
GROUP BY cr.status
ORDER BY cr.status;

-- 5) Non-active relationships with coach_feedback on weekly_logs
SELECT cr.status, COUNT(DISTINCT cr.id) AS relationships, COUNT(cf.id) AS feedback_rows
FROM public.coaching_relationships cr
JOIN public.weekly_logs wl ON wl.relationship_id = cr.id AND wl.deleted_at IS NULL
JOIN public.coach_feedback cf ON cf.weekly_log_id = wl.id AND cf.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND cr.status <> 'active'
GROUP BY cr.status
ORDER BY cr.status;

-- GO: staging project confirmed, helpers exist, preflight exported.
-- NO-GO: production project, or has_active_status_filter already true (0043 may be applied).
