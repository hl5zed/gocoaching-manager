-- =============================================================================
-- 제안용입니다. 바로 적용하지 마세요.
-- Supabase SQL Editor / staging에서 기존 정책·함수·컬럼을 확인한 뒤 migration으로 반영하세요.
-- =============================================================================
-- 목적: /my-coaching 범위에서 service_role 의존을 줄이기 위한 RLS 보완 제안
-- 대상: weekly_logs, profiles(assigned coach read), organizations(member read)
-- 참고: moksilgi/goals/coach_feedback/coaching_relationships 정책은 0024 등에 이미 존재
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. weekly_logs — RLS 활성화
-- 테이블: public.weekly_logs (0019_create_weekly_logs.sql)
-- 컬럼: coachee_profile_id, relationship_id, week_start, week_end, deleted_at, status, ...
-- -----------------------------------------------------------------------------

ALTER TABLE public.weekly_logs ENABLE ROW LEVEL SECURITY;

-- coachee: 본인 주간 기록 조회
DROP POLICY IF EXISTS "coachee can read own weekly logs" ON public.weekly_logs;
CREATE POLICY "coachee can read own weekly logs"
ON public.weekly_logs
FOR SELECT
TO authenticated
USING (
  public.weekly_logs.deleted_at IS NULL
  AND public.weekly_logs.coachee_profile_id = public.current_profile_id()
);

-- coachee: 본인 주간 기록 작성 (배정된 relationship만)
DROP POLICY IF EXISTS "coachee can insert own weekly logs" ON public.weekly_logs;
CREATE POLICY "coachee can insert own weekly logs"
ON public.weekly_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.weekly_logs.coachee_profile_id = public.current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.id = public.weekly_logs.relationship_id
      AND cr.coachee_profile_id = public.current_profile_id()
      AND cr.deleted_at IS NULL
  )
);

-- coachee: 본인 주간 기록 수정 (본문·status·submitted_at 등)
DROP POLICY IF EXISTS "coachee can update own weekly logs" ON public.weekly_logs;
CREATE POLICY "coachee can update own weekly logs"
ON public.weekly_logs
FOR UPDATE
TO authenticated
USING (
  public.weekly_logs.deleted_at IS NULL
  AND public.weekly_logs.coachee_profile_id = public.current_profile_id()
)
WITH CHECK (
  public.weekly_logs.coachee_profile_id = public.current_profile_id()
);

-- coachee: soft delete (deleted_at 설정)
-- UPDATE 정책으로 deleted_at 변경을 허용. 별도 DELETE 정책은 두지 않음.
-- (앱의 removeMyWeeklyLog()가 soft delete UPDATE를 사용)

-- coach: 배정된 coachee의 submitted/reviewed 주간 기록 조회 (필요 시)
DROP POLICY IF EXISTS "coach can read assigned coachee weekly logs" ON public.weekly_logs;
CREATE POLICY "coach can read assigned coachee weekly logs"
ON public.weekly_logs
FOR SELECT
TO authenticated
USING (
  public.weekly_logs.deleted_at IS NULL
  AND public.is_coach_for_coachee(public.weekly_logs.coachee_profile_id)
);

-- -----------------------------------------------------------------------------
-- 2. profiles — 배정 코치 limited read (display_name, full_name, email)
-- 피코치가 코치 이름을 weekly-log / feedback / me.relationships UI에 표시할 때 필요
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "coachee can read assigned coach profiles" ON public.profiles;
CREATE POLICY "coachee can read assigned coach profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.profiles.deleted_at IS NULL
  AND public.profiles.status <> 'anonymized'
  AND EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.coach_profile_id = public.profiles.id
      AND cr.coachee_profile_id = public.current_profile_id()
      AND cr.deleted_at IS NULL
  )
);

-- -----------------------------------------------------------------------------
-- 3. organizations — 소속 멤버 timezone read
-- home/goals 페이지: profiles.organization_id → organizations.default_timezone
-- -----------------------------------------------------------------------------

-- organizations RLS가 아직 없다면 활성화 (이미 다른 정책이 있으면 충돌 확인 후 적용)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member can read own organization timezone" ON public.organizations;
CREATE POLICY "member can read own organization timezone"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  public.organizations.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = public.current_profile_id()
      AND p.organization_id = public.organizations.id
      AND p.deleted_at IS NULL
      AND p.status <> 'anonymized'
  )
);

-- -----------------------------------------------------------------------------
-- 적용 후 검증 (staging)
-- -----------------------------------------------------------------------------
-- 1. 피코치 JWT로 weekly_logs SELECT/INSERT/UPDATE (soft delete) 테스트
-- 2. 타 coachee weekly_logs 접근 거부 확인
-- 3. 배정 코치 profile id만 profiles SELECT 가능 확인
-- 4. organization default_timezone 조회 후 home/goals service_role 제거 가능 여부 판단
-- 5. src/lib/api/my-coaching/weekly-log.ts server client 전환
-- 6. page.tsx / goals/page.tsx organizations 조회 server client 전환
