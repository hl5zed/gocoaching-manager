-- Migration: 0037_add_performance_indexes_round1.sql
-- Purpose: Add first-round performance indexes for frequently used admin,
-- coach-maker, and report queries. This migration does not change schema,
-- RLS policies, table structures, columns, or enums.

-- Speeds up active role filtering and role summary counts in /admin/users.
CREATE INDEX IF NOT EXISTS idx_user_roles_active_role_profile
  ON public.user_roles (role, profile_id)
  WHERE deleted_at IS NULL
    AND status = 'active'
    AND is_active = true;

-- Supports /admin/users status filtering with newest-first pagination.
CREATE INDEX IF NOT EXISTS idx_profiles_live_status_created
  ON public.profiles (status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Supports /admin/invitations status filtering with newest-first pagination.
CREATE INDEX IF NOT EXISTS idx_invitations_live_status_created
  ON public.invitations (status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Supports coach action note lists and reports by status and newest-first order.
CREATE INDEX IF NOT EXISTS idx_coach_action_notes_live_status_created
  ON public.coach_action_notes (status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Supports coach-maker current-week weekly log range lookups by relationship.
CREATE INDEX IF NOT EXISTS idx_weekly_logs_live_relationship_week_range
  ON public.weekly_logs (relationship_id, week_start, week_end)
  WHERE deleted_at IS NULL;
