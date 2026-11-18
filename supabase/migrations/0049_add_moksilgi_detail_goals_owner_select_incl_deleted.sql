-- 세부 목표 소프트 삭제(UPDATE ... SET deleted_at = now()) 시 42501
-- "new row violates row-level security policy" 오류를 해결한다.
--
-- 원인:
--   UPDATE에 WHERE 조건(id, plan_id, deleted_at 등)이 있으면 Postgres는 SELECT 권한을
--   요구하고, SELECT 정책의 USING 조건을 "업데이트된 새 행"에도 검사한다.
--   기존 SELECT 정책("coachee can read own moksilgi detail goals")은
--   deleted_at IS NULL 조건을 포함하므로, deleted_at이 채워진 새 행이 이를 통과하지 못해
--   UPDATE 전체가 거부된다. (RETURNING 유무와 무관)
--
-- 해결:
--   deleted_at 조건 없이 "내 plan의 행"이면 읽기를 허용하는 permissive SELECT 정책을 추가한다.
--   permissive 정책은 OR로 결합되므로 소프트 삭제된 새 행도 통과한다.
--   기존 정책은 그대로 두며, 애플리케이션 조회는 모두 .is("deleted_at", null)로 필터링한다.
--   소유권 경계(내 plan이 아닌 데이터 접근 불가)는 동일하게 유지된다.

DROP POLICY IF EXISTS "coachee can read own moksilgi detail goals incl deleted" ON public.moksilgi_detail_goals;
CREATE POLICY "coachee can read own moksilgi detail goals incl deleted"
ON public.moksilgi_detail_goals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.moksilgi_plans p
    WHERE p.id = public.moksilgi_detail_goals.plan_id
      AND p.profile_id = public.current_profile_id()
      AND p.deleted_at IS NULL
  )
);
