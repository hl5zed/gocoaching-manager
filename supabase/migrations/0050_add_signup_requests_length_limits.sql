-- =============================================================================
-- Migration: 0050_add_signup_requests_length_limits.sql
-- Project:   GOThriveCoaching
-- Purpose:   공개 가입 신청(signup_requests) 텍스트 칸에 길이 상한을 둔다.
--
-- 배경 (출시 전 점검 P2):
--   signup_requests는 비로그인(anon) 방문자가 직접 INSERT할 수 있는 유일한 테이블이다.
--   기존에는 email/name의 "빈 값 금지"만 있고 길이 상한이 없어, anon key로
--   매우 긴 텍스트를 반복 INSERT해 관리자 가입 신청 목록과 DB 용량을 오염시킬 수 있었다.
--
-- 범위:
--   - CHECK 제약만 추가한다. 컬럼, RLS 정책, 트리거, 인덱스는 변경하지 않는다.
--   - invitations, profiles, user_roles, accept_invitation RPC는 건드리지 않는다.
--   - NOT VALID로 추가하므로 기존 행은 검사하지 않고, 이후 INSERT/UPDATE에만 적용된다.
--     (기존 데이터 때문에 migration이 실패하지 않도록 하기 위함)
--
-- 상한 (문자 수, SignupForm의 maxLength와 동일하게 유지):
--   email 254 / name 100 / affiliation_text 200 / region_text 100
--   generation_text 50 / ministry_position 50 / self_introduction 500
--   requested_locale 10 / rejected_reason 2000
--   (rejected_reason은 관리자가 반려 시 입력하지만, anon INSERT 정책이 이 칸을
--    막지 않으므로 함께 상한을 둔다. 관리자 입력을 막지 않도록 여유 있게 잡았다.)
--
-- 적용 전 확인 (선택): 기존 행 중 상한을 넘는 것이 있는지
--   SELECT id FROM public.signup_requests
--   WHERE length(email) > 254 OR length(name) > 100
--      OR length(affiliation_text) > 200 OR length(region_text) > 100
--      OR length(generation_text) > 50 OR length(ministry_position) > 50
--      OR length(self_introduction) > 500 OR length(requested_locale) > 10
--      OR length(rejected_reason) > 2000;
--   결과가 0건이면 마지막의 VALIDATE 구문까지 실행해도 된다.
--
-- 롤백:
--   ALTER TABLE public.signup_requests DROP CONSTRAINT IF EXISTS signup_requests_length_chk;
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signup_requests_length_chk'
  ) THEN
    ALTER TABLE public.signup_requests
      ADD CONSTRAINT signup_requests_length_chk
      CHECK (
        length(email) <= 254
        AND length(name) <= 100
        AND (affiliation_text IS NULL OR length(affiliation_text) <= 200)
        AND (region_text IS NULL OR length(region_text) <= 100)
        AND (generation_text IS NULL OR length(generation_text) <= 50)
        AND (ministry_position IS NULL OR length(ministry_position) <= 50)
        AND (self_introduction IS NULL OR length(self_introduction) <= 500)
        AND (requested_locale IS NULL OR length(requested_locale) <= 10)
        AND (rejected_reason IS NULL OR length(rejected_reason) <= 2000)
      )
      NOT VALID;
  END IF;
END $$;

-- (선택) 위 "적용 전 확인" 쿼리가 0건일 때만 실행:
-- ALTER TABLE public.signup_requests VALIDATE CONSTRAINT signup_requests_length_chk;
