-- =============================================================================
-- Migration: 0051_add_keepalive_ping.sql
-- Project:   GOThriveCoaching
-- Purpose:   Supabase 무료 플랜의 비활성 자동 중지(7일)를 막기 위한 확인용 테이블.
--
-- 배경:
--   .github/workflows/supabase-keepalive.yml 이 하루 3회 anon key로
--   GET /rest/v1/keepalive_ping?select=id&limit=1 을 호출해 실제 DB 쿼리를 발생시킨다.
--
-- 범위:
--   - 개인정보 없는 1행짜리 테이블과 anon SELECT 전용 RLS 정책만 추가한다.
--   - INSERT/UPDATE/DELETE 정책은 두지 않는다 (anon/authenticated 모두 쓰기 불가).
--   - invitations, profiles, user_roles, weekly_logs, accept_invitation RPC는 건드리지 않는다.
--   - 재실행해도 실패하지 않도록 IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS 사용.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.keepalive_ping (
  id integer PRIMARY KEY
);

INSERT INTO public.keepalive_ping (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.keepalive_ping ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.keepalive_ping TO anon;

DROP POLICY IF EXISTS "keepalive_ping_anon_select" ON public.keepalive_ping;

CREATE POLICY "keepalive_ping_anon_select"
  ON public.keepalive_ping
  FOR SELECT
  TO anon
  USING (true);
