# Cursor 작업 명령어 — F1: 목실기 진행현황 plans·관계 조회 1000행 잘림 방지 + 공용 헬퍼 통일

> ⚠️ **coach-maker 데이터 흐름.** 한 번에 이 한 가지만.
> **권한/스코프 판정과 계산 결과는 바꾸지 않는다** — 1000행에서 잘리던 조회를 끝까지 받게만 한다.

---

## 배경 (문제)

`src/lib/api/coach-maker/moksilgi-progress.ts`의 `getCoachMakerMoksilgiProgress`에는 범위 제한 없는 조회가 남아 있다.
Supabase는 요청 1회에 최대 1000행만 주므로 아래 조회들이 **오류 없이 잘린다.**

| 조회 | 위치(쿼리 내용으로 찾기) | 잘리면 생기는 일 |
|---|---|---|
| plans 전체(`allPlansResult`, 페이지네이션 시 개요용) | `Promise.all([count, plansSelectQuery().range(...), plansSelectQuery()])`의 세 번째 | 목실기 1000건 초과 시 개요·인쇄 데이터 누락 |
| plans(비페이지네이션 경로) | `else` 분기의 `applyMoksilgiPlansFiltersToQuery(...)` | `/coach-maker/report`에서 1000건 초과분 누락 |
| 코칭 관계(직접 코칭 범위) | `.eq("coach_profile_id", profileId)` 관계 조회 | 코치이 1000명 초과 시 누락(가능성 낮음) |
| 코칭 관계(넓은 범위) | `let relationshipQuery = …` 스코프 `.or()` 조회 | 관계 1000건 초과 시 관계 표 누락 |

또한 1차 작업에서 이 파일에만 만든 로컬 헬퍼(`fetchAllPages`, `chunkIds`, `mapWithConcurrency`, `fetchAllPagesByIdChunks`)가
3차 공용 헬퍼 `src/lib/supabase/fetch-in-chunks.ts`와 중복된다.

---

## 수정 파일 (정확히 1개)

- **EDIT**: `src/lib/api/coach-maker/moksilgi-progress.ts`

## 건드리지 않을 것

- `src/lib/supabase/fetch-in-chunks.ts`: 읽기만 한다. 수정이 필요해 보이면 **멈추고 보고**한다.
- 권한/스코프 판정: session, profile·roles 조회(2차 병렬화 포함), `BROAD_ACCESS_ROLES`, `resolveScopedProfileIds` 판정 로직
- `MAX_DB_PREFILTER_PROFILE_IDS`(200): `buildDbPrefilters`의 여러 사전 필터와 공유하고, 관계 경로에는 메모리 재필터가 없다. **값을 바꾸지 않는다**(Step 3 참고).
- 현재 페이지 조회(`plansSelectQuery().range(pageFrom, pageTo)`), count 조회
- `applyMoksilgiPlansFiltersToQuery`, `buildDbPrefilters` 본문, 계산 함수 전부, 반환 타입
- `supabase/**`, `package.json`, 다른 모든 파일

---

## Step 1 — 로컬 헬퍼를 공용 헬퍼로 교체

1. 파일 상단에 `import { fetchAllByIdChunks, fetchAllPages } from "@/lib/supabase/fetch-in-chunks";`를 추가한다.
2. 로컬 함수 `fetchAllPages`, `chunkIds`, `mapWithConcurrency`, `fetchAllPagesByIdChunks`와 상수 `EXCEL_RATE_PAGE_SIZE`, `ID_CHUNK_SIZE`, `ID_CHUNK_CONCURRENCY`를 삭제한다.
   - 삭제 전에 다른 곳에서 쓰는지 grep으로 확인한다.
3. 호출부의 `fetchAllPagesByIdChunks` → `fetchAllByIdChunks`로 이름만 바꾼다. 인자 형태는 같다.

> 동작 차이 확인: 공용 헬퍼의 기본값(페이지 1000, 묶음 150, 동시 3)은 로컬 헬퍼와 같다. 오류 타입만 `ChunkQueryError`로 좁혀진다.
> 이 파일의 호출부는 `result.error`를 truthy 검사만 하므로 영향이 없다.

## Step 2 — plans 조회 2곳에 페이징

`plansSelectQuery`는 이미 `updated_at desc, created_at desc, id desc` 순으로 정렬한다. 마지막 키가 `id`라서 페이지 경계가 안정적이다.

```ts
// 페이지네이션 경로: Promise.all의 세 번째 항목
fetchAllPages<PlanRow>((from, to) => plansSelectQuery().range(from, to)),
```

- `allPlansResult`가 기존과 같은 `{ data, error }` 형태로 유지되는지 확인한다.
- 비페이지네이션 `else` 분기도 같은 쿼리를 `fetchAllPages`로 감싸고 마지막에 `.range(from, to)`를 붙인다.
- **묶음(chunk)으로 나누지 않는다.** 전체 정렬 순서가 깨진다.

## Step 3 — 관계 조회 2곳에 페이징 + 관계 `.or()` 전용 상한

1. 직접 코칭 범위(`.eq("coach_profile_id", profileId)`): `fetchAllPages`로 감싸고 `.order("id", { ascending: true }).range(from, to)`를 붙인다.
2. 넓은 범위(`let relationshipQuery = …`): 3차 coach-stats와 같은 방식으로 바꾼다.
   - `resolveScopedProfileIds` 호출과 `orParts` 계산은 **1번만** 실행해 or 문자열(또는 `null`)을 변수에 담는다.
   - `(from, to) => 기본 쿼리 → (있으면) .or(…) → .order("id").range(from, to)` 함수를 `fetchAllPages`에 넘긴다.
3. **상한(200)은 바꾸지 않는다.** coach-stats와 달리 이 경로는 관계를 메모리에서 다시 거르지 않는다. DB 필터 결과(`activeRelationships`)를 그대로 화면에 쓴다(확인 완료).
   - 상한을 낮추면 폴백(전체 관계 조회)이 더 자주 일어나고, **보이는 관계가 늘어나는 동작 변화**가 생긴다.
   - URL 길이 위험(최대 약 15KB)은 남는다. 보고에 "미해결 위험"으로 적는다.

> 📌 **별도 보고할 것 (이번 범위에서 수정 금지):**
> 스코프 프로필이 200명을 넘으면 `resolveScopedProfileIds`가 `null`을 돌려준다. 그러면 `.or()` 사전 필터 없이 **전체 active 관계**가 그대로 `activeRelationships`가 된다.
> 지역 스코프 coach_maker가 범위 밖 관계까지 볼 수 있는 기존 동작으로 보인다. 권한 범위 문제이므로 성능 작업과 분리해 확인·수정한다(Codex 담당).

---

## 검증

1. `npm run typecheck` / `npm run check:all` / `npm run build` 모두 통과
2. 결과 동일성 (현재 규모에서는 완전히 같아야 함):
   - `/coach-maker/moksilgi-progress` 상단 요약, 1페이지·마지막 페이지, 인쇄 미리보기 행 수, 관계 표
   - `/coach-maker/report` 목실기 영역
   - 계정: super_admin, 지역 스코프 coach_maker, 직접 코칭만 있는 coach_maker
3. (선택) 로컬에서 공용 헬퍼의 `DEFAULT_PAGE_SIZE`를 임시로 `2`로 바꿔 수치가 같은지 확인한 뒤 **반드시 되돌린다.** 헬퍼 파일 변경은 커밋하지 않는다.

## 보고 형식

- 변경 파일, 삭제한 로컬 헬퍼, 페이징을 적용한 조회 목록(라인)
- 미해결 위험: 관계 `.or()` URL 길이(상한 200 유지)
- 별도 보고: 스코프 200명 초과 시 전체 관계 노출 가능성
- typecheck / check:all / build 결과
