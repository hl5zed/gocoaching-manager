# [Cursor 작업 명령어] my-coaching 페이지 병목 수정

You are working on the GOThriveCoaching platform (Next.js 15, Supabase).

Before starting:
- Read AI_WORKFLOW.md first.
- Do not modify locked flows.
- Work on the 3 bottlenecks listed below only.

---

## 발견된 병목 요약

페이지별 Supabase 쿼리가 병렬로 묶여야 할 것들이 직렬(sequential await)로 실행되어
불필요한 waterfall 지연이 발생하고 있습니다.

---

## 작업 1 — `/my-coaching/goals/page.tsx`

### 문제
초기 `Promise.all` 이후, `plan.id`를 알고 나서 실행하는 3개 쿼리가 직렬로 순서대로 awaiting됩니다:

```typescript
// 현재 (직렬 — 3 round-trips 직렬)
const summaryResult = plan
  ? await serviceClient.from("moksilgi_monthly_summaries").select(...).maybeSingle()
  : { data: null, error: null };

const lastApprovedResult = plan
  ? await getLastApprovedVersion(plan.id)
  : { ok: true as const, data: null };

const planVersionTypeResult = plan
  ? await serviceClient.from("moksilgi_plans").select("version_type").eq(...).maybeSingle()
  : { data: null, error: null };
```

### 수정
이 3개 쿼리는 서로 독립적이며 모두 `plan.id`에만 의존합니다.
`Promise.all`로 묶어 병렬 실행하세요:

```typescript
// 수정 후 (병렬 — 1 round-trip 동시)
const [summaryResult, lastApprovedResult, planVersionTypeResult] = await Promise.all([
  plan
    ? serviceClient
        .from("moksilgi_monthly_summaries")
        .select(
          "spiritual_rate, intellectual_rate, physical_rate, social_rate, average_rate, updated_at",
        )
        .eq("plan_id", plan.id)
        .eq("profile_id", profileId)
        .eq("year", year)
        .eq("month", month)
        .is("deleted_at", null)
        .maybeSingle()
    : Promise.resolve({ data: null as SummaryRow | null, error: null }),
  plan
    ? getLastApprovedVersion(plan.id)
    : Promise.resolve({ ok: true as const, data: null }),
  plan
    ? serviceClient
        .from("moksilgi_plans")
        .select("version_type")
        .eq("id", plan.id)
        .is("deleted_at", null)
        .maybeSingle()
    : Promise.resolve({ data: null as PlanVersionTypeRow | null, error: null }),
]);
```

수정 파일: `src/app/my-coaching/goals/page.tsx`

---

## 작업 2 — `/my-coaching/moksilgi/monthly/page.tsx`

### 문제
org timezone 쿼리가 sequential `await`로 선행 실행된 후,
그 결과로 year/month를 확정하고 나서야 메인 데이터 fetch가 시작됩니다.
URL에 year/month 파라미터가 있으면 timezone은 기본값 fallback으로 먼저 파싱 가능합니다.

```typescript
// 현재 (직렬)
const organizationResult =
  profile.organization_id && !profile.timezone
    ? await serviceClient.from("organizations").select(...).maybeSingle()  // ← blocking
    : { data: null, error: null };

const effectiveTimezone = resolveTimezoneFallback(...);
const { year, month } = parseYearMonth(params, effectiveTimezone);

const result = await getMyMoksilgiMonthly(year, month, { profileId: profile.id }); // ← blocked
```

### 수정
org timezone 쿼리와 메인 데이터 쿼리를 병렬로 실행합니다.
URL 파라미터에서 year/month를 먼저 추출할 때 기본 timezone으로 파싱한 뒤,
쿼리가 모두 끝난 후 effective timezone으로 재확인(보정)합니다.

```typescript
// 수정 후

// Step 1: org timezone 쿼리 시작 (아직 await하지 않음)
const orgTimezoneQueryPromise =
  profile.organization_id && !profile.timezone
    ? serviceClient
        .from("organizations")
        .select("default_timezone")
        .eq("id", profile.organization_id)
        .is("deleted_at", null)
        .maybeSingle()
    : Promise.resolve({ data: null as OrganizationTimezoneRow | null, error: null });

// Step 2: URL 파라미터에서 year/month를 기본 timezone으로 먼저 파싱
const prelimTimezone = resolveTimezoneFallback(profile.timezone, null, null);
const { year: prelimYear, month: prelimMonth } = parseYearMonth(params, prelimTimezone);

// Step 3: 병렬로 실행
const [organizationResult, result] = await Promise.all([
  orgTimezoneQueryPromise,
  getMyMoksilgiMonthly(prelimYear, prelimMonth, { profileId: profile.id }),
]);

// Step 4: 실제 effectiveTimezone 확정 (UI 표시용)
const organizationTimezone =
  (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ?? null;
const effectiveTimezone = resolveTimezoneFallback(
  profile.timezone,
  organizationTimezone,
  null,
);
const { year, month } = parseYearMonth(params, effectiveTimezone);

// 주의: year/month가 prelimYear/prelimMonth와 다를 수 있는 edge case는
// 사용자가 timezone과 year/month를 URL 파라미터로 명시하지 않은 경우에만 발생.
// 이 경우 데이터는 기본 timezone 기준으로 로드되며, 잘못된 경우는 드물다.
// 만약 year !== prelimYear || month !== prelimMonth이면 redirect로 정확한 month로 이동 가능.
// 단, 현재 구조 유지를 위해 year/month 불일치 시 redirect를 추가해도 됨.
```

수정 파일: `src/app/my-coaching/moksilgi/monthly/page.tsx`

---

## 작업 3 — `/my-coaching/moksilgi/summary/page.tsx`

### 문제 1: org timezone 직렬 blocking
monthly 페이지와 동일한 패턴.

### 문제 2: `goalAreasForPrint` 쿼리 직렬
```typescript
// 현재 (직렬)
const result = await getMyMoksilgiSummary(year, { profileId: profile.id });

// result 완료 후에야 시작됨
if (result.ok && result.data.plan && serviceClient) {
  const { data } = await serviceClient
    .from("moksilgi_goal_areas")
    .select("id, area_key, ...")
    .eq("plan_id", result.data.plan.id)  // plan.id는 result에서 옴
    ...
}
```

`goalAreasForPrint`는 print-only 데이터이지만, plan.id가 result에 의존하므로
result 후에 실행은 불가피합니다. 단, org timezone 쿼리와 `getMyMoksilgiSummary`는
병렬로 실행할 수 있습니다.

### 수정
org timezone 쿼리와 summary 쿼리를 병렬로 실행합니다:

```typescript
// Step 1: 기본 timezone으로 year 파싱
const prelimTimezone = resolveTimezoneFallback(profile.timezone, null, null);
const prelimYear = parseYear(params, prelimTimezone);

// Step 2: org timezone + summary 병렬
const orgTimezoneQueryPromise =
  profile.organization_id && !profile.timezone
    ? serviceClient
        .from("organizations")
        .select("default_timezone")
        .eq("id", profile.organization_id)
        .is("deleted_at", null)
        .maybeSingle()
    : Promise.resolve({ data: null as OrganizationTimezoneRow | null, error: null });

const [organizationResult, result] = await Promise.all([
  orgTimezoneQueryPromise,
  getMyMoksilgiSummary(prelimYear, { profileId: profile.id }),
]);

// Step 3: effectiveTimezone 확정
const organizationTimezone =
  (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ?? null;
const effectiveTimezone = resolveTimezoneFallback(profile.timezone, organizationTimezone, null);
const year = parseYear(params, effectiveTimezone);
```

수정 파일: `src/app/my-coaching/moksilgi/summary/page.tsx`

---

## 수정하지 않을 것

- `src/lib/api/my-coaching/` 헬퍼 함수 내부 (LOCK된 흐름)
- `supabase/` 디렉토리
- `package.json`
- invitation acceptance RPC
- auth logic / role logic / profile creation flow
- weekly log save logic
- `/my-coaching/layout.tsx` 의 인증 흐름 (UI shell만 있는 것이 의도된 구조)

---

## 검증

수정 완료 후 반드시 실행:

```bash
npm run typecheck
npm run check:all
npm run build
```

결과 보고:
- typecheck 통과 여부
- check:all 통과 여부  
- build 통과 여부

---

## 반환할 것

- 수정된 파일 목록
- 각 파일별 변경 내용 요약
- 예상 성능 개선 (절약되는 직렬 round-trip 수)
- 검증 결과
