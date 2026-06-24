-- Migration: 0042_add_moksilgi_records_performance_index.sql
-- Purpose: Add compound partial index on moksilgi_monthly_records for the
--          common query pattern used by /my-coaching/moksilgi/monthly.
--
-- The records query filters by (plan_id, year, month, deleted_at IS NULL).
-- Previously only single-column indexes existed (plan_id, year, month, deleted_at
-- each separately), requiring PostgreSQL to scan all records for a plan and then
-- filter by year+month. The new compound index allows a direct index seek for
-- the exact month's records.
--
-- moksilgi_monthly_summaries already has an equivalent compound index:
--   moksilgi_monthly_summaries_unique_active ON (plan_id, year, month) WHERE deleted_at IS NULL
-- This migration brings moksilgi_monthly_records to the same level.
--
-- No schema, RLS, table structure, column, enum, or data changes.

CREATE INDEX IF NOT EXISTS idx_moksilgi_monthly_records_plan_year_month
  ON public.moksilgi_monthly_records (plan_id, year, month)
  WHERE deleted_at IS NULL;
