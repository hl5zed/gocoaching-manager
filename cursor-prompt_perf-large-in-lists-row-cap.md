# Cursor 작업 명령어 — 규모 대비: 대용량 `.in()` URL 길이 오류 + 1000행 잘림 방지 (coach-stats)

> ⚠️ **coach-maker 데이터 흐름.** 사용자가 명시적으로 승인한 단일 개선.
> 한 번에 이 한 가지만. **권한/스코프 판정과 집계 방식은 바꾸지 않는다** — 같은 데이터를 "나눠서, 끝까지" 가져오도록만 바꾼다.
> Part A는 사람이 DB에서 확인하는 작업, Part B만 코드 수정이다.

---

## 배경 (문제 2가지)

### 1) `.in()`에 id 수백 개 → URL 길이 한도 초과 위험

Supabase(PostgREST)는 필터를 **URL 쿼리 문자열**로 보낸다. UUID는 개당 약 37자다.
- 300개면 약 11KB, 500개면 약 18KB가 된다.
- 게이트웨이 한도(환경마다 다르며 대략 8~16KB)를 넘으면 `414 URI Too Long` 같은 오류로 **화면 전체가 실패**한다.
- 지금은 사용자가 적어 드러나지 않지만, 상위 관리자(super_admin, country_admin)가 넓은 범위를 볼 때 먼저 터진다.

### 2) 1000행 상한 → 숫자가 조용히 틀어짐

Supabase API는 기본값으로 요청 1회에 **최대 1000행**만 돌려준다(Max Rows).
`range`·`limit` 없이 조회하면 1000행에서 잘리는데, **오류 없이** 일부만 받은 채로 집계된다.
- 예: 코치이 500명 × 이번 주 하루 기록 7일 = 3,500행 → 1,000행만 집계 → 공유율·현황 수치가 실제보다 낮게 표시된다.
- 속도 문제가 아니라 **정확성 문제**다.

## 대상: `src/lib/api/coach-maker/coach-stats.ts`

| 함수 | 위치 | 쿼리 | 1) URL | 2) 1000행 |
|---|---|---|---|---|
| `getCoachMakerCoachStats` | L541 | coaching_relationships (active 전체 또는 스코프) | – | ⚠️ |
| | L615 | profiles `.in("id", profileIds)` | ⚠️ | ⚠️ |
| | L674 | weekly_logs `.in("relationship_id", …)` | ⚠️ | ⚠️ |
| | L681 | daily_records `.in("profile_id", coacheeIds)` | ⚠️ | ⚠️ |
| | L690 | monthly_reflections `.in("profile_id", coacheeIds)` | ⚠️ | ⚠️ |
| | L751 | coach_feedback `.in("weekly_log_id", …)` | ⚠️ | ⚠️ |
| `getCoachMakerMoksilgiDashboardSummary` | L1003 | coaching_relationships (본인 코치이) | – | ⚠️ |
| | L1046 | moksilgi_plans (전체 범위면 `.in` 없음) | – | ⚠️ |
| | L1079 | profiles `.in("id", profileIds)` | ⚠️ | ⚠️ |
| | L1087 | moksilgi_monthly_summaries `.in("plan_id", planIds)` | ⚠️ | ⚠️ |
| | L1114 | regions `.in("id", regionIds)` | (적음) | – |

> 라인 번호는 2번 명령어(`cursor-prompt_perf-roundtrip-region.md`) 적용 전 기준이다. 적용 후라면 몇 줄 밀려 있다. **쿼리 내용으로 찾는다.**

---

## Part A — DB 설정·인덱스 확인 (코드 수정 없음, 사람이 확인)

Supabase SQL Editor에서 실행하고 결과를 보고에 붙인다.

```sql
-- 1) user_roles 인덱스: profile_id로 시작하는 인덱스가 있는지
select indexname, indexdef from pg_indexes where tablename = 'user_roles';

-- 2) 규모 확인: 1000행/URL 한도에 얼마나 가까운지
select
  (select count(*) from profiles where deleted_at is null) as profiles,
  (select count(*) from coaching_relationships where status = 'active' and deleted_at is null) as active_relationships,
  (select count(*) from daily_records where deleted_at is null and record_date >= current_date - 7) as daily_records_last_7d;
```

- Supabase 대시보드 → Project Settings → API → **Max Rows** 값(기본 1000)을 확인한다. 아래 Part B는 이 값과 상관없이 동작한다.
- `user_roles`에 `profile_id`로 시작하는 인덱스가 없으면 **보고만 한다.** migration 생성은 이번 범위가 아니며 별도 승인이 필요하다.

---

## Part B — 코드 수정

### 수정 파일 (2개)

- **NEW**: `src/lib/supabase/fetch-in-chunks.ts` — 공용 헬퍼
- **EDIT**: `src/lib/api/coach-maker/coach-stats.ts`

### 건드리지 않을 것

- 권한/스코프 판정: session, profile, roles 조회, `hasCoachMakerFullAccess`, `relationshipMatchesScope`, `resolveScopedProfileIds`의 **판정 로직**
- 각 쿼리의 select 컬럼과 필터 조건(`eq`/`gte`/`lte`/`is`/`or`), 사용하는 client
- 메모리 집계·필터 코드(`scopedRelationships`, 카운트 계산 등) 전부
- 오류 코드·메시지·`logServerError` 호출
- 반환 타입과 필드
- `moksilgi-progress.ts`: 1번 명령어에서 같은 목적의 로컬 헬퍼를 만든다. 이 공용 헬퍼로 옮기는 것은 이번 범위 밖이다.
- `src/proxy.ts`, `src/lib/auth/**`, `supabase/**`, `package.json`, 다른 모든 파일
- 작업 트리에 이미 있는 미커밋 변경(`src/lib/api/admin/coaching-relationships.ts`, `next-env.d.ts`)

### Step 1 — 공용 헬퍼 `src/lib/supabase/fetch-in-chunks.ts`

`any`·`@ts-ignore` 금지. 서버 전용 파일이며 Supabase 타입에 의존하지 않는다.

```ts
type QueryResult = PromiseLike<{ data: unknown; error: unknown }>;

export const DEFAULT_PAGE_SIZE = 1000;
export const DEFAULT_ID_CHUNK_SIZE = 150;
const DEFAULT_CHUNK_CONCURRENCY = 3;

/**
 * range(from, to)로 1000행씩 끝까지 가져온다.
 * fetchPage 안의 쿼리는 반드시 고유 컬럼(id 등)으로 order 해야 페이지 경계에서 중복·누락이 없다.
 */
export async function fetchAllPages<TRow>(
  fetchPage: (from: number, to: number) => QueryResult,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<{ data: TRow[]; error: unknown }> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: [], error };

    const page = (data ?? []) as TRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return { data: rows, error: null };
}

export function chunkIds(ids: string[], size: number = DEFAULT_ID_CHUNK_SIZE): string[][] {
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
 * ids를 묶음(기본 150개)으로 나누고, 묶음마다 fetchAllPages로 끝까지 가져와 이어 붙인다.
 * 동시 실행은 최대 3묶음. ids가 비어 있으면 요청 없이 빈 배열을 돌려준다.
 */
export async function fetchAllByIdChunks<TRow>(
  ids: string[],
  fetchPage: (chunk: string[], from: number, to: number) => QueryResult,
): Promise<{ data: TRow[]; error: unknown }> {
  if (ids.length === 0) return { data: [], error: null };

  const results = await mapWithConcurrency(
    chunkIds(ids),
    DEFAULT_CHUNK_CONCURRENCY,
    (chunk) => fetchAllPages<TRow>((from, to) => fetchPage(chunk, from, to)),
  );

  const failed = results.find((result) => result.error);
  if (failed) return { data: [], error: failed.error };

  return { data: results.flatMap((result) => result.data), error: null };
}
```

> ⚠️ Supabase 쿼리 빌더는 `await`/`.then` 전까지 요청을 보내지 않는다. 헬퍼는 `fetchPage`를 호출한 즉시 `await`하므로 문제없다.

### Step 2 — `.in()` 쿼리 교체 (위 표의 ⚠️ URL 항목)

패턴: select·필터는 그대로 두고 `.in(col, 전체ids)` → `.in(col, chunk)`, 끝에 `.order("id", { ascending: true }).range(from, to)`를 붙인다.

```ts
// 예: L681 daily_records
const dailyRecordsResult = await fetchAllByIdChunks<SharedDailyStatsRow>(
  coacheeIds,
  (chunk, from, to) =>
    serviceClient
      .from("daily_records")
      .select("id, profile_id, relationship_id, shared_with_coach, visibility")
      .in("profile_id", chunk)
      .eq("shared_with_coach", true)
      .eq("visibility", "coach")
      .gte("record_date", weekRange.start)
      .lte("record_date", weekRange.end)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to),
);
```

- 결과는 기존처럼 `{ data, error }`이므로 아래의 `xxxResult.error` 검사와 `xxxResult.data` 캐스팅은 **그대로 동작**해야 한다. 기존 캐스팅 타입을 제네릭 인자로 넘긴다.
- 기존 `Promise.all`로 묶여 있던 쿼리(L672 weekly/daily/monthly, L1078 profiles/summaries)는 `Promise.all` 구조를 유지한 채 각 항목만 교체한다.
  기존의 `ids.length > 0 ? … : Promise.resolve({ data: [], error: null })` 분기는 헬퍼가 빈 배열을 처리하므로 **남겨 두어도, 지워도 결과가 같다.** 남겨 두는 쪽을 택한다(최소 변경).
- `moksilgi_monthly_summaries`, `coach_feedback` 등의 select에 `id`가 없어도 `order("id")`는 가능하다(정렬만 하고 반환하지 않음). 반환 행 형태는 바뀌지 않는다.
- regions(L1114)는 지역 수가 적으므로 **바꾸지 않는다.**

### Step 3 — `.in()`이 없는 무제한 조회에 페이징만 추가 (표의 2) 항목 중 URL "–")

- **L541 coaching_relationships**: `fetchAllPages`로 감싸고 `.order("id", { ascending: true }).range(from, to)`를 붙인다.
  기존 `.or(...)` 스코프 사전 필터 조립 코드는 **그대로** 두고, 완성된 `relationshipQuery`에 order/range만 붙이는 방식으로 한다.
  권장 순서:
  1. `resolveScopedProfileIds`와 `orParts` 계산은 **기존 위치에서 1번만** 실행한다. 페이지마다 다시 부르지 말 것 — DB 왕복이 늘어난다.
  2. 계산된 or 문자열(또는 `null` = 필터 없음)을 변수에 담는다.
  3. `(from, to) => { 기본 쿼리 → (or 문자열이 있으면) .or(…) → .order("id").range(from, to) }` 형태의 함수를 `fetchAllPages`에 넘긴다.
  - 조립 로직을 두 군데로 복사하지 말고 한 곳에만 둔다.
- **L1003 coaching_relationships (본인 코치이)**: 같은 방식으로 `fetchAllPages` 적용.
- **L1046 moksilgi_plans**: 기존 정렬(`updated_at desc, created_at desc, id desc`)을 **그대로 유지**한 채 `.range(from, to)`만 붙여 `fetchAllPages`로 감싼다.
  마지막 정렬 키가 `id`라서 페이지 경계가 안정적이다. **이 쿼리는 묶음으로 나누지 않는다** — 나누면 전체 정렬 순서가 깨진다
  (`accessibleProfileIds`는 코치 1명의 코치이 목록이라 URL 위험이 낮다).

### Step 4 — 스코프 사전 필터 상한 낮추기 (1줄)

`resolveScopedProfileIds` 결과는 `.or()` 안에 `coach_profile_id.in.(…)`, `coachee_profile_id.in.(…)` **두 번** 들어간다.
상한 200이면 URL이 약 15KB까지 커진다.

```ts
const MAX_SCOPE_PREFILTER_PROFILE_IDS = 100; // 기존 200
```

- 상한을 넘으면 기존 설계대로 **사전 필터를 포기하고 전체 조회로 폴백**한다. 최종 결과는 메모리 필터(`relationshipMatchesScope`)가 보장하므로 **동일하다.**
  폴백 시에도 Step 3 덕분에 1000행에서 잘리지 않는다.
- `moksilgi-progress.ts`의 같은 이름 상수(200)는 이번 범위 밖이다. 보고에만 언급한다.

---

## 검증

1. 아래 명령 모두 통과:
   ```bash
   npm run typecheck
   npm run check:all
   npm run build
   ```
2. **결과 동일성** (현재 데이터 규모에서는 수정 전/후 수치가 완전히 같아야 한다):
   - `/coach-maker` 대시보드: 코치/코치이 수, 이번 주 주간기록 제출·피드백 현황, 공유 하루기록·월간회고 수치
   - `/coach-maker` 목실기 요약 카드: 전체/누락/주의 건수, 현재까지 평균
   - `/coach-maker/report` 같은 영역 수치
   - 계정 3종: super_admin(전체), 지역 스코프 coach_maker, 코치 스코프 coach_maker
3. (선택) 로컬에서 `DEFAULT_ID_CHUNK_SIZE`와 `DEFAULT_PAGE_SIZE`를 임시로 `2`로 바꿔 실행한다.
   수치가 그대로인지 확인해 묶음·페이징 경계에서 누락이나 중복이 없음을 검증한 뒤 **반드시 원래 값으로 되돌린다.**

## 보고 형식

- Part A: 인덱스 조회 결과, 규모 조회 결과, Max Rows 값
- Part B: 변경 파일, 교체한 쿼리 목록(라인), 의도적으로 바꾸지 않은 것(regions, plans 묶음 미적용, moksilgi-progress 상수)
- typecheck / check:all / build 결과
- 검증 3번을 했다면 그 결과

---

## 이번 범위 밖 (별도 승인 필요한 후속 후보)

- **`src/lib/api/admin/coaching-genealogy.ts`** (`.in()` 19곳, 약 2,900줄): 같은 헬퍼로 별도 작업. 파일이 커서 함수 단위로 나눠 진행한다.
- **`moksilgi-progress.ts`**: 1번 명령어의 로컬 헬퍼를 이 공용 헬퍼로 교체하고, 스코프 상한 200 → 100 조정.
- **`coach/dashboard.ts`, `coach/moksilgi.ts`, `admin/users.ts`** 등 나머지 `.in()` 사용처 점검.
- **`user_roles(profile_id)` 인덱스 migration**: Part A 결과 없을 때만.
