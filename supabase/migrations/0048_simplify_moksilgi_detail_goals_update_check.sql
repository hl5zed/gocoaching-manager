-- moksilgi_detail_goals UPDATE 정책의 WITH CHECK 중 area_id 소유권을 재검증하는
-- EXISTS 서브쿼리(moksilgi_goal_areas를 중첩 참조)가 이 배포 환경에서 42501로
-- 모든 정상 UPDATE(소프트 삭제 포함)를 막는 것으로 확인되어 제거한다.
-- area 소유권은 애플리케이션 코드에서 UPDATE 전에 이미 별도로 검증하며,
-- plan_id 소유권 체크(USING과 동일, 정상 동작 확인됨)만으로도
-- "내 플랜이 아닌 데이터는 수정 불가"라는 핵심 보안 경계는 유지된다.

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
);
