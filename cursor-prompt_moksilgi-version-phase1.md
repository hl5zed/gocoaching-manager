# Cursor 작업 명령어 — 목실기 버전 관리 Phase 1

## 작업 목표

`moksilgi_plans`에 버전 메타데이터 컬럼을 추가하고,  
`moksilgi_plan_versions` 테이블을 생성하여 버전 스냅샷을 보관한다.  
피코치 화면에 **코치 승인본 vs 현재 실행본** 이중 표시를 추가한다.  
기존 `getOwnedPlan` (`status = 'active'`) 쿼리는 **절대 변경하지 않는다.**

## 수정 파일 (최대 4개)

- **NEW MIGRATION**: `supabase/migrations/<timestamp>_add_moksilgi_version_fields.sql`
- **NEW**: `src/lib/api/my-coaching/moksilgi-versions.ts`
- **EDIT**: `src/app/my-coaching/goals/page.tsx` (버전 배지 표시만 추가)
- **EDIT**: `src/lib/api/my-coaching/moksilgi.ts` (MoksilgiVersionType 타입만 추가, 기존 함수 수정 없음)

## 건드리지 않을 것

- `getOwnedPlan` 함수 (status = 'active' 쿼리 유지)
- `saveMyMoksilgiPlan` 함수
- `moksilgi/page.tsx` (편집 페이지)
- `weekly_logs` 관련 모든 파일
- invitation / auth / role / profile 흐름
- `package.json`
- RLS 정책 (직접 수정 금지 — migration SQL에 포함)

---

## Step 1 — Migration 파일 생성

파일명: `supabase/migrations/<현재_timestamp>_add_moksilgi_version_fields.sql`

```sql
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

CREATE INDEX IF NOT EXISTS moksilgi_plan_versions_plan_id_version_number_idx
  ON moksilgi_plan_versions(plan_id, version_number);

-- RLS 설정
ALTER TABLE moksilgi_plan_versions ENABLE ROW LEVEL SECURITY;

-- 피코치: 자기 plan의 versions만 읽기/쓰기 허용
CREATE POLICY "coachee_select_own_versions"
  ON moksilgi_plan_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moksilgi_plans p
      WHERE p.id = moksilgi_plan_versions.plan_id
        AND p.profile_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "coachee_insert_own_versions"
  ON moksilgi_plan_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM moksilgi_plans p
      WHERE p.id = moksilgi_plan_versions.plan_id
        AND p.profile_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );
```

---

## Step 2 — 타입 + API 파일 생성

### 2a. `src/lib/api/my-coaching/moksilgi.ts` 수정 (최소)

기존 파일 끝에 **타입만 추가**한다. 기존 함수/로직은 변경하지 않는다.

```ts
// ---- 추가할 타입 (파일 끝에 append) ----
export const MOKSILGI_VERSION_TYPES = [
  "draft",
  "submitted",
  "approved",
  "self_updated",
  "review_requested",
] as const;

export type MoksilgiVersionType = (typeof MOKSILGI_VERSION_TYPES)[number];

export function isMoksilgiVersionType(value: unknown): value is MoksilgiVersionType {
  return (
    typeof value === "string" &&
    (MOKSILGI_VERSION_TYPES as readonly string[]).includes(value)
  );
}

export const MOKSILGI_VERSION_TYPE_LABELS: Record<MoksilgiVersionType, string> = {
  draft: "작성 중",
  submitted: "코치 검토 대기",
  approved: "코치 승인 완료",
  self_updated: "자기 업데이트",
  review_requested: "코치 재검토 요청",
};
```

### 2b. `src/lib/api/my-coaching/moksilgi-versions.ts` 신규 생성

```ts
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { MoksilgiVersionType } from "./moksilgi";

// ------------------------------------------------------------------
// 타입
// ------------------------------------------------------------------

export type MoksilgiPlanVersionRow = {
  id: string;
  plan_id: string;
  version_number: number;
  version_type: MoksilgiVersionType;
  snapshot_json: Record<string, unknown>;
  change_reason: string | null;
  created_by: string;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
};

export type CreateVersionInput = {
  plan_id: string;
  version_number: number;
  version_type: MoksilgiVersionType;
  /** plan의 현재 필드 + goal_areas + detail_goals를 JSON 스냅샷으로 전달 */
  snapshot_json: Record<string, unknown>;
  change_reason?: string;
  created_by: string;
};

// ------------------------------------------------------------------
// 버전 목록 조회 (최신순)
// ------------------------------------------------------------------

export async function getMoksilgiVersions(planId: string): Promise<
  | { ok: true; data: MoksilgiPlanVersionRow[] }
  | { ok: false; error: string }
> {
  const { client, error: clientError } = createSupabaseServiceClient();
  if (!client) {
    console.error("[MOKSILGI_VERSIONS_CLIENT_UNAVAILABLE]", clientError);
    return { ok: false, error: "서비스 클라이언트를 초기화할 수 없습니다." };
  }

  const { data, error } = await client
    .from("moksilgi_plan_versions")
    .select(
      "id, plan_id, version_number, version_type, snapshot_json, change_reason, created_by, is_approved, approved_at, approved_by, created_at",
    )
    .eq("plan_id", planId)
    .order("version_number", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[MOKSILGI_VERSIONS_FETCH_ERROR]", error);
    return { ok: false, error: "버전 이력을 불러올 수 없습니다." };
  }

  return { ok: true, data: (data ?? []) as MoksilgiPlanVersionRow[] };
}

// ------------------------------------------------------------------
// 최근 코치 승인 버전 조회
// ------------------------------------------------------------------

export async function getLastApprovedVersion(planId: string): Promise<
  | { ok: true; data: MoksilgiPlanVersionRow | null }
  | { ok: false; error: string }
> {
  const { client, error: clientError } = createSupabaseServiceClient();
  if (!client) {
    console.error("[MOKSILGI_APPROVED_VERSION_CLIENT_UNAVAILABLE]", clientError);
    return { ok: false, error: "서비스 클라이언트를 초기화할 수 없습니다." };
  }

  const { data, error } = await client
    .from("moksilgi_plan_versions")
    .select(
      "id, plan_id, version_number, version_type, snapshot_json, change_reason, created_by, is_approved, approved_at, approved_by, created_at",
    )
    .eq("plan_id", planId)
    .eq("is_approved", true)
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[MOKSILGI_APPROVED_VERSION_FETCH_ERROR]", error);
    return { ok: false, error: "코치 승인 버전을 불러올 수 없습니다." };
  }

  return { ok: true, data: (data as MoksilgiPlanVersionRow | null) ?? null };
}

// ------------------------------------------------------------------
// 새 버전 스냅샷 저장
// ------------------------------------------------------------------

export async function createMoksilgiVersion(input: CreateVersionInput): Promise<
  | { ok: true; data: MoksilgiPlanVersionRow }
  | { ok: false; error: string }
> {
  const { client, error: clientError } = createSupabaseServiceClient();
  if (!client) {
    console.error("[MOKSILGI_CREATE_VERSION_CLIENT_UNAVAILABLE]", clientError);
    return { ok: false, error: "서비스 클라이언트를 초기화할 수 없습니다." };
  }

  const { data, error } = await client
    .from("moksilgi_plan_versions")
    .insert({
      plan_id: input.plan_id,
      version_number: input.version_number,
      version_type: input.version_type,
      snapshot_json: input.snapshot_json,
      change_reason: input.change_reason ?? null,
      created_by: input.created_by,
      is_approved: input.version_type === "approved",
      approved_at: input.version_type === "approved" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error("[MOKSILGI_CREATE_VERSION_ERROR]", error);
    return { ok: false, error: "버전을 저장할 수 없습니다." };
  }

  return { ok: true, data: data as MoksilgiPlanVersionRow };
}
```

---

## Step 3 — goals/page.tsx에 버전 배지 추가

파일: `src/app/my-coaching/goals/page.tsx`

**추가할 것만**: 기존 "목표 설계 화면 열기" 안내 카드에 현재 version_type 배지를 표시한다.

### 추가 import (파일 상단):
```ts
import { getLastApprovedVersion } from "@/lib/api/my-coaching/moksilgi-versions";
import { MOKSILGI_VERSION_TYPE_LABELS, isMoksilgiVersionType } from "@/lib/api/my-coaching/moksilgi";
```

### 데이터 조회 추가 (plan이 있을 때만):

기존 `summaryResult` 조회 바로 아래에 추가:
```ts
const lastApprovedResult = plan
  ? await getLastApprovedVersion(plan.id)
  : { ok: true as const, data: null };

const lastApproved = lastApprovedResult.ok ? lastApprovedResult.data : null;

const currentVersionType = isMoksilgiVersionType(
  (plan as { version_type?: unknown } | null)?.version_type
)
  ? ((plan as { version_type: string }).version_type as import("@/lib/api/my-coaching/moksilgi").MoksilgiVersionType)
  : null;
```

### JSX 수정 — 기존 안내 카드에 배지 추가:

기존 안내 카드의 `<ButtonLink>` 위에 추가:
```tsx
{currentVersionType && currentVersionType !== "approved" ? (
  <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
    <span aria-hidden>⚠️</span>
    현재 상태:{" "}
    <span className="font-semibold">{MOKSILGI_VERSION_TYPE_LABELS[currentVersionType]}</span>
    {lastApproved ? ` · 코치 승인본: v${lastApproved.version_number}` : ""}
  </p>
) : currentVersionType === "approved" && lastApproved ? (
  <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
    <span aria-hidden>✓</span>
    코치 승인 완료{" "}
    <span className="font-semibold">v{lastApproved.version_number}</span>
    {lastApproved.approved_at
      ? ` · ${new Date(lastApproved.approved_at).toLocaleDateString("ko-KR")}`
      : ""}
  </p>
) : null}
```

---

## 주의사항

1. **`any` 사용 금지** — snapshot_json은 `Record<string, unknown>` 사용
2. **`@ts-ignore` 사용 금지**
3. **migration 파일명**: `supabase/migrations/` 폴더의 기존 파일 타임스탬프보다 큰 값 사용
4. **기존 `moksilgi.ts`의 `PLAN_SELECT` 상수 수정 금지**
5. `goals/page.tsx`에서 `plan` 타입이 `version_type` 필드를 아직 포함하지 않으므로, 타입 단언 대신 optional chaining + `isMoksilgiVersionType` 가드 사용

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## Return 형식

- 생성/수정한 파일 목록
- 추가된 기능
- 의도적으로 건드리지 않은 것
- typecheck / check:all / build 결과
