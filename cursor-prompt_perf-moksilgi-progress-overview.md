# Cursor 작업 명령어 — 성능: 목실기 진행현황 전체 월 실적 조회 병목 완화

> ⚠️ **coach-maker 데이터 흐름.** 사용자가 명시적으로 승인한 단일 성능 개선.
> 한 번에 이 한 가지만. **계산 결과(행·개요·인쇄 데이터)는 소수점까지 동일해야 한다** — DB 요청 방식만 바꾼다.

---

## 배경 (병목)

`src/lib/api/coach-maker/moksilgi-progress.ts`의 `getCoachMakerMoksilgiProgress`는
목록이 20건 페이지네이션이어도, 개요(overview)·인쇄용 데이터(`printRows`, `printRelationshipRows`)를 만들기 위해
**필터에 맞는 전체 plan**을 가져온 뒤 그 전체에 대해 월 실적을 계산한다.

```
L1451  Promise.all: count + 현재 페이지 plans + 전체 plans(allPlansResult, range 없음)
L1519  profiles IN (전체 plan의 profile_id + 관계 id)          ← id 수백 개를 URL에 그대로
L1530  loadExcelMonthlySummaries(전체 plans)
L1021    goal_areas / detail_goals / monthly_records 각각
           .in("plan_id", 전체 planIds)                       ← id 수백 개를 URL에 그대로
           fetchAllPages: 1000행씩 "순차" 반복                 ← 핵심 지연
```

예) 300명 × 세부목표 20개 × 12개월 = 월 실적 약 72,000행 → **1000행 요청 72번을 하나씩 기다림.**
페이지 이동·필터 변경 때마다 반복되며, `/coach-maker/report`도 같은 함수를 호출한다.

추가 위험: `.in()`에 UUID 수백 개(개당 약 37자)가 들어가면 PostgREST 요청 URL 길이 한도에 걸려
**오류가 날 수 있다.** 사용자가 늘수록 먼저 터지는 지점이다.

## 이번 작업의 범위 (결과 불변 보장)

전체 데이터가 필요한 것은 인쇄·개요 기능 때문이므로 **가져오는 데이터의 범위는 그대로 둔다.**
대신:

1. `planIds`를 **150개 단위 묶음(chunk)** 으로 나눠 URL 길이 문제를 없앤다.
2. 묶음들을 **동시 3개까지 병렬**로 가져와, 순차 72회 대기를 묶음 수 ÷ 3 수준으로 줄인다.
3. profiles 조회(L1519)도 같은 방식으로 묶음 처리한다.

묶음은 **plan_id 기준**으로 나누므로 한 plan의 영역·목표·실적은 항상 한 묶음 안에 있다.
묶음 안에서는 기존과 같이 `order("id")` 정렬을 유지하므로 plan별 행 순서도 기존과 같다
→ `buildMoksilgiExcelSummary` 입력이 동일 → **결과 동일.**

---

## 수정 파일 (정확히 1개)

- **EDIT**: `src/lib/api/coach-maker/moksilgi-progress.ts`

## 건드리지 않을 것

- 권한/스코프 판정 (L1206~L1410: session, profile, roles, relationships, `resolveScopedProfileIds`, `buildDbPrefilters`)
- plans 조회 쿼리와 필터(`applyMoksilgiPlansFiltersToQuery`, L1451 `Promise.all` 구성)
- `buildMoksilgiExcelSummary`, `buildProgressRows`, `buildPrintRows`, `buildProgressSummary`, `buildProgressOverview`, `EXCEL_MONTH_SCALE` 계산식
- 반환 타입·필드(`rows`, `printRows`, `printRelationshipRows`, `overview`, `pagination` …)
- `supabase/**`, migration, RLS, `package.json`, 다른 모든 파일
- 작업 트리에 이미 있는 미커밋 변경(`src/lib/api/admin/coaching-relationships.ts`, `next-env.d.ts`) — 손대지도, 함께 커밋하지도 말 것

---

## Step 1 — 헬퍼 추가

`fetchAllPages`(L993) 바로 아래에 추가한다. `any` 금지, `@ts-ignore` 금지.

```ts
const ID_CHUNK_SIZE = 150;
const ID_CHUNK_CONCURRENCY = 3;

function chunkIds(ids: string[], size: number = ID_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  limit: number,
  worker: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = new Array<TOutput>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * id 목록을 묶음으로 나눠 묶음별로 fetchAllPages를 실행한다(동시 ID_CHUNK_CONCURRENCY개).
 * 묶음 순서대로 이어 붙이므로, 묶음 키(plan_id 등)별 행 순서는 기존 단일 쿼리와 같다.
 */
async function fetchAllPagesByIdChunks<TRow>(
  ids: string[],
  fetchPage: (
    chunk: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<{ data: TRow[]; error: unknown }> {
  if (ids.length === 0) return { data: [], error: null };

  const chunkResults = await mapWithConcurrency(
    chunkIds(ids),
    ID_CHUNK_CONCURRENCY,
    (chunk) => fetchAllPages<TRow>((from, to) => fetchPage(chunk, from, to)),
  );

  const failed = chunkResults.find((result) => result.error);
  if (failed) return { data: [], error: failed.error };

  return { data: chunkResults.flatMap((result) => result.data), error: null };
}
```

## Step 2 — `loadExcelMonthlySummaries`(L1013)의 3개 쿼리 교체

`Promise.all` 구조와 select 컬럼·필터·정렬은 **그대로** 두고, `fetchAllPages` → `fetchAllPagesByIdChunks`,
`.in("plan_id", planIds)` → `.in("plan_id", chunk)` 만 바꾼다.

```ts
const [areasResult, goalsResult, recordsResult] = await Promise.all([
  fetchAllPagesByIdChunks<ExcelAreaRow>(planIds, (chunk, from, to) =>
    serviceClient
      .from("moksilgi_goal_areas")
      .select("id, plan_id, area_key")
      .in("plan_id", chunk)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to),
  ),
  fetchAllPagesByIdChunks<ExcelGoalRow>(planIds, (chunk, from, to) =>
    serviceClient
      .from("moksilgi_detail_goals")
      .select("id, plan_id, area_id, measurement_type, annual_target")
      .in("plan_id", chunk)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to),
  ),
  fetchAllPagesByIdChunks<ExcelRecordRow>(planIds, (chunk, from, to) =>
    serviceClient
      .from("moksilgi_monthly_records")
      .select("plan_id, profile_id, detail_goal_id, month, actual_value")
      .in("plan_id", chunk)
      .eq("year", year)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to),
  ),
]);
```

> 동시 요청 수: 테이블 3개 × 묶음 3개 = 최대 9개. 이보다 늘리지 말 것(Supabase 연결 부담).

## Step 3 — profiles 조회(L1519) 묶음 처리

현재:

```ts
profileIds.length > 0
  ? serviceClient
      .from("profiles")
      .select("id, display_name, full_name, email, country_id, region_id, organization_id, church_id, group_id, ministry_position, generation_number, primary_role")
      .in("id", profileIds)
      .is("deleted_at", null)
  : Promise.resolve({ data: [], error: null }),
```

변경: 같은 select·필터로 `fetchAllPagesByIdChunks`를 사용하고, 정렬은 `order("id", { ascending: true })`를 추가한다
(profiles는 이후 `mapById`로만 쓰이므로 순서 무관 — L1640 확인).

- 결과가 기존처럼 `{ data, error }` 형태로 아래 코드(`profilesResult.error`, `profilesResult.data`)에 그대로 들어가야 한다.
- 행 타입은 기존에 `profilesResult.data`를 캐스팅하던 타입을 그대로 제네릭 인자로 쓴다. 새 타입을 만들지 말 것.

---

## 검증

1. 아래 명령 모두 통과:
   ```bash
   npm run typecheck
   npm run check:all
   npm run build
   ```
2. **결과 동일성 확인** (수정 전/후 같은 연도·필터로 비교):
   - `/coach-maker/moksilgi-progress` 상단 요약 카드(완료/진행/미시작, 누락/주의 건수)
   - 1페이지·마지막 페이지의 월별 성취율과 누적 성취율
   - 인쇄 미리보기 전체 행 수와 평균 행
   - `/coach-maker/report`의 목실기 영역 수치
3. 서버 로그 `[API_PERFORMANCE]`에서 `route: "/coach-maker/moksilgi-progress"`의
   `data.overview_plans_query`(건수)와 그 다음 단계의 `deltaMs`를 수정 전/후 비교해 보고한다.

## 보고 형식

- 변경 파일
- 추가한 헬퍼와 교체한 쿼리 위치(라인)
- 의도적으로 바꾸지 않은 것
- typecheck / check:all / build 결과
- 수정 전/후 `deltaMs` 비교(측정했다면)

---

## 이번 범위 밖 (별도 승인 필요한 후속 후보)

이번 작업은 **대기 시간**만 줄이고, DB가 처리하는 총 행 수는 그대로다. 사용자가 더 늘면 아래 중 하나가 필요하다.

- **A. 계산 결과 단기 캐시**: `loadExcelMonthlySummaries` 결과를 (연도 + 정렬된 planIds 해시) 키로 `unstable_cache` 60초 캐시.
  입력이 이미 권한 검증된 id라 권한 누출은 없지만, 실적 저장 직후 최대 60초 늦게 반영될 수 있다 → 동작 변화라 승인 필요.
- **B. DB 집계 RPC/view**: plan별·월별 성취율을 DB에서 계산해 plan당 12행만 받는다. migration 필요 → 승인 필요.
- **C. 인쇄 데이터 지연 로딩**: `printRows`/`printRelationshipRows`를 인쇄 버튼을 누를 때만 별도 요청.
  `page.tsx`·클라이언트 컴포넌트 props 변경이 따라오므로 별도 작업.
