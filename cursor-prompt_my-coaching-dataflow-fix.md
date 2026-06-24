# [Cursor 작업 명령어] my-coaching 페이지 그룹 데이터 흐름 병목 수정

You are working on the GOThriveCoaching platform (Next.js 15 App Router, Supabase).

Before starting:
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do not modify locked flows (auth / role / profile / weekly log save / invitation RPC).
- Work on ONLY the 3 files listed below. 파일 3개 초과 금지.
- 각 작업은 **동작은 동일하게 유지**하면서 불필요한 직렬/중복 쿼리만 제거하는 것이 목표입니다.

---

## 0. 대상 페이지와 현재 데이터 흐름 (배경)

분석한 7개 화면의 관계:

```
/dashboard ──(바로가기/카드)──▶ /my-coaching (오늘의 목표 허브)
                                     │
   ┌─────────────────────────────────┼─────────────────────────────────┐
   ▼                                 ▼                                 ▼
/my-coaching/goals          /my-coaching/moksilgi          /my-coaching/records
 (나의 성장: 읽기)            (목표 설계: 작성)              (기록 목록/검색)
                                     │
                       ┌─────────────┴─────────────┐
                       ▼                           ▼
        /my-coaching/moksilgi/monthly   /my-coaching/moksilgi/summary
              (월별 체크리스트)               (연간 성취표)
```

공통 패턴:
- 모든 페이지가 `export const dynamic = "force-dynamic"` → 매 이동마다 풀 서버 렌더 + DB 왕복.
- 인증/프로필은 `requireCoacheePageProfile()` → `getMyCoachingMe()` 1회 조회로 이미 잘 정리됨.
- `getSession()`은 React `cache()`로 감싸져 있어 같은 요청 내 중복 호출은 무료. (수정 불필요)
- 따라서 남은 병목은 **페이지 내부의 직렬(waterfall) 쿼리 + 중복 쿼리**뿐입니다.

> 참고: `/my-coaching/goals`의 "plan.id 이후 3개 쿼리 병렬화"와 `/my-coaching/records`의
> "3개 fetch 병렬화"는 **이미 `Promise.all`로 적용 완료** 상태입니다. 건드리지 마세요.

---

## 작업 1 — `/my-coaching/moksilgi/monthly/page.tsx` (org timezone waterfall 제거)

### 문제
조직 타임존 쿼리를 먼저 `await`로 끝낸 뒤에야 메인 데이터(`getMyMoksilgiMonthly`)가 시작되어
2개의 독립적인 쿼리가 직렬로 실행됩니다. (현재 약 714~733행)

```typescript
// 현재 (직렬: org timezone → 그 다음 main data)
const organizationResult =
  profile.organization_id && !profile.timezone
    ? await serviceClient.from("organizations").select("default_timezone")...maybeSingle()
    : { data: null, error: null };

const effectiveTimezone = resolveTimezoneFallback(profile.timezone, organizationTimezone, null);
const { year, month } = parseYearMonth(params, effectiveTimezone);

const result = await getMyMoksilgiMonthly(year, month, { profileId: profile.id }); // ← 위가 끝나야 시작
```

### 수정
두 쿼리를 병렬 실행합니다. `year/month`는 먼저 **예비 타임존**(profile.timezone 우선, 없으면 기본)으로
파싱해 메인 쿼리를 즉시 시작하고, org 타임존 결과가 오면 effective 타임존을 확정합니다.

```typescript
// 1) org timezone 쿼리를 시작만 해둠 (await 안 함)
const orgTimezonePromise =
  profile.organization_id && !profile.timezone
    ? serviceClient
        .from("organizations")
        .select("default_timezone")
        .eq("id", profile.organization_id)
        .is("deleted_at", null)
        .maybeSingle()
    : Promise.resolve({ data: null as OrganizationTimezoneRow | null, error: null });

// 2) 예비 타임존으로 year/month 먼저 파싱 (profile.timezone이 있으면 effective와 동일)
const prelimTimezone = resolveTimezoneFallback(profile.timezone, null, null);
const prelim = parseYearMonth(params, prelimTimezone);

// 3) org 타임존 + 메인 데이터 병렬 실행
const [organizationResult, prelimResult] = await Promise.all([
  orgTimezonePromise,
  getMyMoksilgiMonthly(prelim.year, prelim.month, { profileId: profile.id }),
]);

// 4) effective 타임존 확정
const organizationTimezone =
  (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ?? null;
const effectiveTimezone = resolveTimezoneFallback(profile.timezone, organizationTimezone, null);
const { year, month } = parseYearMonth(params, effectiveTimezone);

// 5) 드문 edge case 보정:
//    URL에 year/month 파라미터가 없고, org 타임존 때문에 월 경계가 바뀌어
//    prelim과 effective의 (year, month)가 달라진 경우에만 정확한 월로 1회 재조회.
//    (profile.timezone이 설정된 사용자는 prelim === effective 이므로 절대 진입 안 함)
const result =
  year === prelim.year && month === prelim.month
    ? prelimResult
    : await getMyMoksilgiMonthly(year, month, { profileId: profile.id });
```

이후 기존 코드(`saved`, `error`, `hasData`, `areaStats` 등)는 `year`, `month`, `result`를
그대로 사용하므로 변경 없음.

수정 파일: `src/app/my-coaching/moksilgi/monthly/page.tsx`

---

## 작업 2 — `/my-coaching/moksilgi/summary/page.tsx` (org timezone waterfall 제거)

### 문제
monthly와 동일 패턴. org 타임존 쿼리를 `await`로 끝낸 뒤 `getMyMoksilgiSummary`가 시작됩니다.
(현재 약 326~345행) 그 뒤 `goalAreasForPrint` 쿼리는 `result.data.plan.id`에 의존하므로
result 이후 실행이 불가피합니다(병렬화 대상 아님).

### 수정
org 타임존 쿼리와 summary 쿼리를 병렬화합니다. summary는 `year`(월 무관)만 필요하므로 보정이 더 간단합니다.

```typescript
const orgTimezonePromise =
  profile.organization_id && !profile.timezone
    ? serviceClient
        .from("organizations")
        .select("default_timezone")
        .eq("id", profile.organization_id)
        .is("deleted_at", null)
        .maybeSingle()
    : Promise.resolve({ data: null as OrganizationTimezoneRow | null, error: null });

// 예비 타임존으로 year 파싱 후 즉시 메인 쿼리 시작
const prelimTimezone = resolveTimezoneFallback(profile.timezone, null, null);
const prelimYear = parseYear(params, prelimTimezone);

const [organizationResult, prelimResult] = await Promise.all([
  orgTimezonePromise,
  getMyMoksilgiSummary(prelimYear, { profileId: profile.id }),
]);

const organizationTimezone =
  (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ?? null;
const effectiveTimezone = resolveTimezoneFallback(profile.timezone, organizationTimezone, null);
const year = parseYear(params, effectiveTimezone);

const result =
  year === prelimYear
    ? prelimResult
    : await getMyMoksilgiSummary(year, { profileId: profile.id });
```

`currentYear`, `currentMonthInTimezone`, `goalAreasForPrint` 등 이후 로직은 그대로 둡니다.

수정 파일: `src/app/my-coaching/moksilgi/summary/page.tsx`

---

## 작업 3 — `/my-coaching/goals/page.tsx` (중복 version_type 쿼리 제거)

### 문제
`getMyMoksilgi(profileId)`가 반환하는 `plan`에는 이미 `version_type` 필드가 포함되어 있습니다
(`PLAN_SELECT`에 `version_type` 존재). 그런데 페이지가 별도로 `moksilgi_plans`를 다시 조회해
`version_type`만 또 가져옵니다(현재 약 207~214행, `planVersionTypeResult`). → **불필요한 1 round-trip.**

```typescript
// 현재: Promise.all 안에 version_type 재조회가 들어있음
const [summaryResult, lastApprovedResult, planVersionTypeResult] = await Promise.all([
  /* summary 쿼리 */,
  /* getLastApprovedVersion(plan.id) */,
  plan
    ? serviceClient.from("moksilgi_plans").select("version_type").eq("id", plan.id)...maybeSingle()
    : Promise.resolve({ data: null as PlanVersionTypeRow | null, error: null }),
]);

const currentVersionType = isMoksilgiVersionType(planVersionTypeResult.data?.version_type)
  ? planVersionTypeResult.data.version_type
  : null;
```

### 수정
`plan.version_type`를 직접 사용하고, 재조회 쿼리를 제거합니다.

```typescript
// version_type 재조회 제거 → Promise.all 항목 2개로 축소
const [summaryResult, lastApprovedResult] = await Promise.all([
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
]);

// plan에 이미 들어있는 version_type 사용
const currentVersionType = isMoksilgiVersionType(plan?.version_type)
  ? plan.version_type
  : null;
```

정리:
- 사용하지 않게 된 `PlanVersionTypeRow` 타입 정의가 다른 곳에서 안 쓰이면 제거(쓰이면 유지).
- `MoksilgiPlan` 타입에 `version_type`이 포함되어 있는지 확인(포함되어 있음). 안 되면 작업 멈추고 보고.

수정 파일: `src/app/my-coaching/goals/page.tsx`

---

## 수정하지 않을 것 (LOCK)

- `src/lib/api/my-coaching/` 내부 헬퍼 함수 로직 (`getMyCoachingMe`, `getMyMoksilgi`,
  `getMyMoksilgiMonthly`, `getMyMoksilgiSummary` 등) — 시그니처/동작 변경 금지.
- `src/lib/auth/getSession.ts` (이미 `cache()`로 최적화됨).
- `src/app/my-coaching/layout.tsx` (UI 셸만 있는 의도된 구조).
- `/my-coaching/records/page.tsx`, `/my-coaching/page.tsx`, `/my-coaching/moksilgi/page.tsx`,
  `/dashboard/page.tsx` — 이미 병렬화되어 있거나 이번 범위 밖.
- DB schema / `supabase/` / migration / RLS / `package.json`.
- 인증 / role / profile / weekly log save / invitation acceptance RPC.

---

## 검증 (필수)

```bash
npm run typecheck
npm run check:all
npm run build
```

세 명령 모두 통과해야 합니다. 실패 시 기능 삭제로 우회하지 말고 원인 보고.

---

## 반환할 것

- 수정한 파일 목록 (3개 이하)
- 파일별 변경 요약
- 제거/병렬화한 직렬·중복 round-trip 수 (예: monthly 1, summary 1, goals 1 = 총 3 round-trip 단축)
- 동작 동일성 확인 메모 (특히 monthly/summary의 timezone edge case 보정)
- typecheck / check:all / build 결과
