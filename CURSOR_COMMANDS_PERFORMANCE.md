# GOThriveCoaching my-coaching 성능 최적화 — Cursor 명령어

> **작성 기준:** 2026-06-21, 최적화 1~3차 완료 이후 잔존 병목 기준  
> **이미 완료된 최적화:** getSession cache(), getMyCoachingMe 옵션화, profiles 중복 쿼리 제거, recalculateSummaryWithContext

---

## 현황 요약 (5개 페이지 토큰 이동 경로)

| 페이지 | DB 쿼리 수 (최적화 후) | 주요 잔존 문제 |
|--------|----------------------|--------------|
| /my-coaching | 4~6회 | ✅ 완료 |
| /my-coaching/goals | 3~4회 | ✅ 완료 |
| /my-coaching/moksilgi/monthly | 5~7회 | context 중복 패턴 (저수위) |
| /my-coaching/records | **8~12회** | profiles 3중 조회, 600건 인메모리 필터 |
| /my-coaching/moksilgi/summary | 3~4회 | getProfileContext 중복 패턴 (저수위) |

---

## 우선순위 1 — records 페이지: type 필터 적용 시 불필요한 API 호출 차단

### 문제
`src/app/my-coaching/records/page.tsx`에서 `typeFilter`가 `"daily"` / `"weekly"` / `"monthly"` 중 하나로 좁혀져 있어도
항상 3개 API(`getDailyRecords`, `getRecentMyWeeklyLogs`, `getMonthlyReflections`)를 모두 호출한다.
사용하지 않는 2개 API 결과는 버려진다.

### 수정 대상 파일
- `src/app/my-coaching/records/page.tsx` (1개 파일)

### Cursor 명령어
```
You are working on src/app/my-coaching/records/page.tsx in the GOThriveCoaching platform.

Context:
- `typeFilter` can be "all" | "daily" | "weekly" | "monthly"
- Currently the page always calls all three: getDailyRecords, getRecentMyWeeklyLogs, getMonthlyReflections
- When typeFilter is "daily", weekly and monthly results are immediately discarded
- LOCK: do not modify getDailyRecords, getMonthlyReflections, getRecentMyWeeklyLogs internals

Task:
Replace the current unconditional Promise.all([getDailyRecords, getRecentMyWeeklyLogs, getMonthlyReflections])
with a conditional version:

- When typeFilter === "daily":   only call getDailyRecords,          skip the other two (resolve to empty arrays)
- When typeFilter === "weekly":  only call getRecentMyWeeklyLogs,    skip the other two
- When typeFilter === "monthly": only call getMonthlyReflections,    skip the other two
- When typeFilter === "all":     call all three (existing behavior)

Use Promise.resolve([]) / Promise.resolve({ ok: true, data: [] }) for skipped calls to match return types.
Keep Promise.all so skipped vs. real calls still run in parallel.

Requirements:
- No any, no @ts-ignore
- Do not modify locked flows (invitation, auth, role, profile, weekly_logs)
- Run: npm run typecheck && npm run check:all
```

---

## 우선순위 2 — records 페이지: profiles 3중 조회 통합

### 문제
`records/page.tsx` 렌더 패스에서 `profiles` 테이블이 최대 3번 조회된다.

1. `records/page.tsx` 자체 → `profiles.timezone` (supabase server client)
2. `getDailyRecords` 내부 → `getCurrentProfile()` → `profiles.id`  
3. `getMonthlyReflections` 내부 → 동일한 `getCurrentProfile()` → `profiles.id`
4. `getRecentMyWeeklyLogs` 내부 → `profiles` (timezone + id 포함 더 넓은 select)

`getSession()`은 `cache()`로 이미 1회로 통합됨. 하지만 `profiles` 조회는 각 함수가 독립적으로 실행한다.

### 수정 대상 파일
- `src/app/my-coaching/records/page.tsx` (1개 파일)

### Cursor 명령어
```
You are working on src/app/my-coaching/records/page.tsx in the GOThriveCoaching platform.

Context:
- The page currently fetches profiles.timezone via its own supabase query (line ~590-597)
- getDailyRecords, getMonthlyReflections, getRecentMyWeeklyLogs each internally call getSession() + their own profiles query
- getSession() is already wrapped in React cache() so auth round-trips are deduplicated
- LOCK: do not modify getDailyRecords, getMonthlyReflections, getRecentMyWeeklyLogs internals

Problem:
The page-level profiles.timezone query is a standalone DB round-trip that runs before the three
API calls. Since getEffectiveTimezone() has a DEFAULT_TIMEZONE fallback, a profiles query failure
does not block rendering.

Task:
Move the page-level `profiles.timezone` fetch into the same Promise.all as the three record APIs,
so it runs in parallel instead of sequentially before them.

Change from:
  const { data: profileTimezone } = await supabase.from("profiles")...   // sequential
  ...
  const [dailyResult, weeklyResult, monthlyResult] = await Promise.all([...])

Change to:
  const [profileTimezoneResult, dailyResult, weeklyResult, monthlyResult] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("auth_user_id", session.user.id)
      .is("deleted_at", null).maybeSingle(),
    getDailyRecords(...),
    getRecentMyWeeklyLogs(...),
    getMonthlyReflections(...),
  ]);
  const profileTimezoneRow = profileTimezoneResult.data as { timezone: string | null } | null;

Requirements:
- session.user is already verified non-null before this point — no change needed there
- No any, no @ts-ignore
- Do not remove the getEffectiveTimezone fallback
- Run: npm run typecheck && npm run check:all
```

---

## 우선순위 3 — records 페이지: 인메모리 필터 범위 축소 (최대 200→50건)

### 문제
`RECORDS_PAGE_LIST_LIMIT = 200`으로, 필터/검색이 활성화되면 3개 API가 각 200건씩 최대 600건을 메모리에 로드한다.
실제 화면에 표시되는 건수는 훨씬 적다. DB 쪽에서 이미 status/visibility/search를 필터링하므로
limit을 줄여도 동작에는 문제 없다.

### 수정 대상 파일
- `src/app/my-coaching/records/page.tsx` (1개 파일)

### Cursor 명령어
```
You are working on src/app/my-coaching/records/page.tsx in the GOThriveCoaching platform.

Context:
- RECORDS_PAGE_LIST_LIMIT = 200 is the per-API fetch limit when any filter/search is active
- When typeFilter narrows to a single type (from Priority 1 fix), only 1 API runs anyway
- getDailyRecords and getMonthlyReflections already push status/visibility/search filters to the DB

Task:
Lower RECORDS_PAGE_LIST_LIMIT from 200 to 50.

Also add a secondary constant RECORDS_PAGE_SEARCH_LIMIT = 200 for when a search query is active
(q param is non-empty), to preserve full-text search coverage:

  const recordsLimit = hasActiveSearchOrFilter
    ? (normalizeSearch(query).length > 0 ? RECORDS_PAGE_SEARCH_LIMIT : RECORDS_PAGE_LIST_LIMIT)
    : RECENT_RECORDS_LIMIT;

This way:
- No active filter → 3 records (existing)
- Filter only (no text search) → 50 records per active API
- Text search → 200 records per active API

Requirements:
- No any, no @ts-ignore
- Do not modify getDailyRecords, getMonthlyReflections, getRecentMyWeeklyLogs internals
- Do not modify RECENT_RECORDS_LIMIT = 3
- Run: npm run typecheck && npm run check:all
```

---

## 우선순위 4 — moksilgi-summary: getProfileContext 중복 제거

### 문제
`src/lib/api/my-coaching/moksilgi-summary.ts`의 `getProfileContext()`가
`src/lib/api/my-coaching/moksilgi-monthly.ts`의 `getContext()`와 로직이 동일하다.
두 파일 모두 `getSession()` → `profiles.id` → `service client` 패턴을 각자 구현한다.

`getSession()`이 이미 `cache()`로 통합돼 있으므로 auth 비용은 없지만,
`profiles.id` 조회는 두 파일이 독립적으로 실행한다.
향후 유지보수 비용을 줄이기 위해 공통 유틸로 추출하는 것이 바람직하다.

### 수정 대상 파일
- `src/lib/api/my-coaching/context.ts` (신규, 40줄 이내)
- `src/lib/api/my-coaching/moksilgi-monthly.ts` (import 수정)
- `src/lib/api/my-coaching/moksilgi-summary.ts` (import 수정)

### Cursor 명령어
```
You are working on the GOThriveCoaching platform.

Context:
- src/lib/api/my-coaching/moksilgi-monthly.ts has getContext() (line 230)
- src/lib/api/my-coaching/moksilgi-summary.ts has getProfileContext() (line 104)
- Both do: getSession() → profiles.select("id") → createSupabaseServiceClient()
- getSession() is already wrapped in React cache() so auth is deduplicated
- LOCK: do not modify invitation, auth, role, profile creation flows

Task:
1. Create src/lib/api/my-coaching/context.ts with a shared exported function:
   export type MoksilgiContext =
     | { ok: true; profileId: string; serviceClient: ServiceClient }
     | { ok: false; error: SafeError };
   export async function getMoksilgiContext(): Promise<MoksilgiContext>
   
   Copy the implementation from moksilgi-monthly.ts getContext() verbatim,
   exporting ServiceClient type as well.

2. In moksilgi-monthly.ts: replace getContext() with import { getMoksilgiContext } from "./context"
   and update all calls from getContext() to getMoksilgiContext().

3. In moksilgi-summary.ts: replace getProfileContext() with import { getMoksilgiContext } from "./context"
   and update all calls accordingly. Note the return shape uses profileId same as moksilgi-monthly.

Files to modify: context.ts (new), moksilgi-monthly.ts, moksilgi-summary.ts (3 files total)

Requirements:
- No any, no @ts-ignore
- Keep existing error codes and messages identical
- Run: npm run typecheck && npm run check:all
```

---

## 우선순위 5 — moksilgi/monthly: Server Action 내 auth 중복 (구조적 제약)

### 문제 및 현황
`saveMonthlyRecordAction` (Server Action) → `saveMyMoksilgiMonthlyRecord` → `getContext()` / `getMoksilgiContext()`:

Server Action은 페이지 렌더와 **별도 요청**이므로 React `cache()`가 공유되지 않는다.
저장 시마다 `getSession()` (auth round-trip) + `profiles.id` 조회가 발생한다.
이것은 **Next.js App Router의 구조적 제약**으로, 현재 아키텍처에서 제거 불가능하다.

`recalculateSummaryWithContext` 최적화(3차)로 저장 후 재조회 5~6회는 이미 제거됐다.
추가 개선은 Server Action을 Route Handler로 교체하는 아키텍처 변경이 필요하므로
현재 단계에서는 진행하지 않는다.

**조치 불필요 — 현 상태 유지**

---

## 검증 명령어

각 Cursor 작업 후 반드시 실행:
```bash
npm run typecheck
npm run check:all
```

빌드 검증 (Windows/Mac 로컬에서):
```bash
npm run build
```

---

## 변경 금지 항목 (LOCK)

- invitation creation / acceptance RPC
- auth logic / role logic / profile creation
- weekly_logs save logic
- DB schema / RLS / migration
- package.json
- `src/lib/auth/getSession.ts` (cache 래핑 완료 — 수정 불필요)
- `src/lib/api/my-coaching/me.ts` (옵션화 완료 — 수정 불필요)
- `src/lib/api/my-coaching/moksilgi-monthly.ts` (recalculateSummaryWithContext 완료 — 수정 불필요)
