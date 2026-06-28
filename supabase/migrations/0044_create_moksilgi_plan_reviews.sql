-- 목실기 기획안 코치 검토(피드백) 테이블
CREATE TABLE IF NOT EXISTS moksilgi_plan_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES moksilgi_plans(id) ON DELETE CASCADE,
  version_id uuid NULL REFERENCES moksilgi_plan_versions(id) ON DELETE SET NULL,
  coach_profile_id uuid NOT NULL REFERENCES profiles(id),
  review_status text NOT NULL DEFAULT 'reviewing'
    CONSTRAINT moksilgi_plan_reviews_status_check
    CHECK (review_status IN ('reviewing', 'changes_requested', 'confirmed', 'approved')),
  feedback_content text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moksilgi_plan_reviews_plan_id_idx
  ON moksilgi_plan_reviews(plan_id);

CREATE INDEX IF NOT EXISTS moksilgi_plan_reviews_coach_profile_id_idx
  ON moksilgi_plan_reviews(coach_profile_id);

CREATE INDEX IF NOT EXISTS moksilgi_plan_reviews_version_id_idx
  ON moksilgi_plan_reviews(version_id);

ALTER TABLE moksilgi_plan_reviews ENABLE ROW LEVEL SECURITY;

-- 피코치: 자기 plan에 연결된 reviews 읽기
CREATE POLICY "coachee_select_own_plan_reviews"
  ON moksilgi_plan_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moksilgi_plans p
      WHERE p.id = moksilgi_plan_reviews.plan_id
        AND p.profile_id = public.current_profile_id()
        AND p.deleted_at IS NULL
    )
  );

-- 코치: 자신이 작성한 reviews 읽기
CREATE POLICY "coach_select_own_reviews"
  ON moksilgi_plan_reviews FOR SELECT
  TO authenticated
  USING (
    coach_profile_id = public.current_profile_id()
  );

-- 코치: 담당 피코치 plan에 피드백 작성
CREATE POLICY "coach_insert_assigned_plan_reviews"
  ON moksilgi_plan_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_profile_id = public.current_profile_id()
    AND EXISTS (
      SELECT 1 FROM coaching_relationships cr
      JOIN moksilgi_plans p ON p.profile_id = cr.coachee_profile_id
      WHERE p.id = moksilgi_plan_reviews.plan_id
        AND cr.coach_profile_id = public.current_profile_id()
        AND cr.status = 'active'
        AND cr.deleted_at IS NULL
        AND p.deleted_at IS NULL
    )
  );

-- 코치: 자신이 작성한 review 수정
CREATE POLICY "coach_update_own_reviews"
  ON moksilgi_plan_reviews FOR UPDATE
  TO authenticated
  USING (coach_profile_id = public.current_profile_id())
  WITH CHECK (coach_profile_id = public.current_profile_id());
