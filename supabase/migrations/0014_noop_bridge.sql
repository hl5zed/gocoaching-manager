-- =============================================================================
-- Migration: 0014_noop_bridge.sql
-- Project:   GOThriveCoaching
-- Purpose:   CRITICAL_REVIEW B7 — bridge gap between 0013 and 0015.
--
-- Context:
--   Production Supabase already has 0013 and 0015 applied; 0014 never existed.
--   This noop restores sequential numbering in git for future CLI/reference use.
--
-- Apply:
--   - Do NOT use `supabase db push` (per project approval).
--   - Optional: run in SQL Editor on fresh environments only if 0014 must exist
--     in migration history before 0015.
--
-- Rollback: not required (no schema change).
-- =============================================================================

SELECT 1;
