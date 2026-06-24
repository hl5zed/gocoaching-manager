-- moksilgi_plans에 버전 메타데이터 컬럼 추가
ALTER TABLE moksilgi_plans
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_type text NOT NULL DEFAULT 'draft'
    CONSTRAINT moksilgi_plans_version_type_check
    CHECK (version_type IN ('draft', 'submitted', 'approved', 'self_updated', 'review_requested')),
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_profile_id uuid REFERENCES profiles(id);

-- 기존 active 플랜은 version_number=1, version_type='approved'로 초기화
-- (이미 코치와 함께 진행 중인 플랜은 승인 상태로 간주)
UPDATE moksilgi_plans
SET version_type = 'approved'
WHERE status = 'active';

-- 버전 스냅샷 테이블 생성
CREATE TABLE IF NOT EXISTS moksilgi_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES moksilgi_plans(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_type text NOT NULL
    CONSTRAINT moksilgi_plan_versions_version_type_check
    CHECK (version_type IN ('draft', 'submitted', 'approved', 'self_updated', 'review_requested')),
  snapshot_json jsonb NOT NULL DEFAULT '{}',
  change_reason text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  is_approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moksilgi_plan_versions_plan_id_idx
  ON moksilgi_plan_versions(plan_id);

DELETE FROM moksilgi_plan_versions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY plan_id, version_number
        ORDER BY created_at ASC, id ASC
      ) AS duplicate_rank
    FROM moksilgi_plan_versions
  ) ranked_versions
  WHERE ranked_versions.duplicate_rank > 1
);

DROP INDEX IF EXISTS moksilgi_plan_versions_plan_id_version_number_idx;

CREATE UNIQUE INDEX moksilgi_plan_versions_plan_id_version_number_idx
  ON moksilgi_plan_versions(plan_id, version_number);

-- 기존 active 플랜의 승인 v1 스냅샷을 만들어 UI/API의 "최근 승인 버전" 조회와 맞춘다.
INSERT INTO moksilgi_plan_versions (
  plan_id,
  version_number,
  version_type,
  snapshot_json,
  change_reason,
  created_by,
  is_approved,
  approved_at,
  approved_by,
  created_at
)
SELECT
  p.id,
  p.version_number,
  'approved',
  jsonb_build_object(
    'plan',
    to_jsonb(p),
    'goal_areas',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.sort_order)
      FROM moksilgi_goal_areas a
      WHERE a.plan_id = p.id
        AND a.deleted_at IS NULL
    ), '[]'::jsonb),
    'detail_goals',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(g) ORDER BY g.sort_order)
      FROM moksilgi_detail_goals g
      WHERE g.plan_id = p.id
        AND g.deleted_at IS NULL
    ), '[]'::jsonb)
  ),
  '기존 활성 목실기 초기 승인 버전',
  p.profile_id,
  true,
  COALESCE(p.approved_at, now()),
  p.approved_by_profile_id,
  now()
FROM moksilgi_plans p
WHERE p.status = 'active'
  AND p.deleted_at IS NULL
ON CONFLICT (plan_id, version_number) DO NOTHING;

-- RLS 설정
ALTER TABLE moksilgi_plan_versions ENABLE ROW LEVEL SECURITY;

-- 피코치: 자기 plan의 versions만 읽기/쓰기 허용
DROP POLICY IF EXISTS "coachee_select_own_versions"
  ON moksilgi_plan_versions;

CREATE POLICY "coachee_select_own_versions"
  ON moksilgi_plan_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moksilgi_plans p
      WHERE p.id = moksilgi_plan_versions.plan_id
        AND p.profile_id = public.current_profile_id()
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "coachee_insert_own_versions"
  ON moksilgi_plan_versions;

CREATE POLICY "coachee_insert_own_versions"
  ON moksilgi_plan_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = public.current_profile_id()
    AND EXISTS (
      SELECT 1 FROM moksilgi_plans p
      WHERE p.id = moksilgi_plan_versions.plan_id
        AND p.profile_id = public.current_profile_id()
        AND p.deleted_at IS NULL
    )
  );
