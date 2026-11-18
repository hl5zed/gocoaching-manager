-- moksilgi_detail_goals의 UPDATE RLS 정책이 배포 환경에서 정상 적용되지 않아
-- (deleted_at 소프트 삭제 등) UPDATE가 0건 매칭으로 조용히 무시되는 문제를 바로잡기 위해
-- 0024_enable_rls_for_new_tables.sql의 정책을 동일한 내용으로 재생성한다.
-- 로직 변경 없음 (DROP 후 동일 정의로 재생성).

DROP POLICY IF EXISTS "coachee can update own moksilgi detail goals" ON public.moksilgi_detail_goals;
CREATE POLICY "coachee can update own moksilgi detail goals"
ON public.moksilgi_detail_goals
FOR UPDATE
TO authenticated
USING (
  public.moksilgi_detail_goals.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_detail_goals.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_detail_goals.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.moksilgi_goal_areas a
    WHERE a.id = public.moksilgi_detail_goals.area_id
      AND a.plan_id = public.moksilgi_detail_goals.plan_id
      AND a.deleted_at IS NULL
  )
);
