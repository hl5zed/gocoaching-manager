# Fix 03 — 계보도 전체 로드 → DB 단 사전 필터

## 현재 문제

`src/lib/api/admin/coaching-genealogy.ts`의 주요 관계 조회 쿼리가
**limit/range 없이** `coaching_relationships` 전체를 불러온 뒤,
메모리에서 `relationshipMatchesScope()` + `relationshipMatchesFilters()`로 걸러낸다.

`church_admin`처럼 좁은 스코프를 가진 관리자도 전 세계 레코드를 전부 로드한 후 필터링한다.

```typescript
// 현재 — 무제한 로드
let relationshipQuery = client
  .from("coaching_relationships")
  .select("id, coach_profile_id, coachee_profile_id, status, scope_type, scope_id, ...")
  .eq("status", filters.status)
  .is("deleted_at", null);
// scope 필터 없음, limit 없음
```

추가로 `profile_generation_history` 히스토리 쿼리도 `.limit(5000)`으로 과도하게 크다.

---

## 작업 목표

1. **relationships 쿼리**: `access.scopes`를 읽어 DB 쿼리 단계에서 스코프 사전 필터를 적용한다.
2. **history 쿼리**: `.limit(5000)` → `.limit(500)`으로 줄인다.

기존 메모리 필터(`relationshipMatchesScope`, `relationshipMatchesFilters`)는 **그대로 유지**한다.
DB 필터는 "추가 보호막"이 아니라 **데이터 로드량을 줄이는 사전 필터**다.

---

## 허용 수정 파일

- `src/lib/api/admin/coaching-genealogy.ts` **한 파일만**

**절대 수정 금지:**

- `supabase/` 하위 모든 파일
- `middleware.ts`
- auth / role / profile / invitation 흐름
- `package.json`
- 기존 `relationshipMatchesScope` / `relationshipMatchesFilters` 함수 로직
- `profileMatchesScope` 함수 로직

---

## Fix 1 — relationships 쿼리에 DB 스코프 필터 추가

### 배경

`access.scopes: AuthRoleScope[]`는 관리자가 가진 역할별 스코프 목록이다.

```typescript
type AuthRoleScope = {
  role: UserRole;
  scope_type: ScopeType;  // "global" | "country" | "region" | "organization" | "church" | ...
  scope_id: string | null;
};
```

`coaching_relationships` 테이블에는 `scope_type`, `scope_id` 컬럼이 있다.

### 스코프 필터 규칙

| 조건 | DB 필터 |
|---|---|
| 스코프 중 하나라도 `scope_type === "global"` | 필터 없음 (전체 허용) |
| 모두 비-global | `scope_type + scope_id` 조합을 OR로 묶어 DB 필터 적용 |
| `scope_id`가 null인 비-global 스코프 | 해당 스코프는 필터 조건에서 제외 |

### 구현 방법

아래 헬퍼 함수를 파일 내 적절한 위치에 추가한다
(기존 `relationshipMatchesScope` 근처 권장):

```typescript
/**
 * access.scopes를 기반으로 coaching_relationships 쿼리에
 * DB 단 사전 필터를 적용한다.
 * global 스코프가 하나라도 있으면 필터를 추가하지 않는다.
 * 반환값: 필터가 적용된 query (타입은 호출부의 Supabase query 빌더 타입과 동일)
 */
function applyRelationshipScopeFilter<T extends { or: (filter: string) => T }>(
  query: T,
  scopes: AuthRoleScope[],
): T {
  // global 스코프가 하나라도 있으면 필터 없이 반환
  if (scopes.some((scope) => scope.scope_type === "global")) {
    return query;
  }

  // scope_id가 있는 비-global 스코프만 수집
  const scopedFilters = scopes
    .filter((scope) => scope.scope_type !== "global" && scope.scope_id !== null)
    .map(
      (scope) =>
        `and(scope_type.eq.${scope.scope_type},scope_id.eq.${scope.scope_id})`,
    );

  if (scopedFilters.length === 0) {
    // 유효한 스코프가 없으면 결과 없음을 보장하는 불가능 조건 추가
    return query.or("scope_type.eq.__none__") as T;
  }

  return query.or(scopedFilters.join(",")) as T;
}
```

### 적용 위치

`getCoachingGenealogyData` 함수 내 아래 블록:

```typescript
// BEFORE
let relationshipQuery = client
  .from("coaching_relationships")
  .select(
    "id, coach_profile_id, coachee_profile_id, status, scope_type, scope_id, created_at, updated_at",
  )
  .eq("status", filters.status)
  .is("deleted_at", null);

if (filters.coachProfileId) {
  relationshipQuery = relationshipQuery.eq(
    "coach_profile_id",
    filters.coachProfileId,
  );
}

const { data: relationshipData, error: relationshipError } =
  await relationshipQuery;
```

```typescript
// AFTER
let relationshipQuery = client
  .from("coaching_relationships")
  .select(
    "id, coach_profile_id, coachee_profile_id, status, scope_type, scope_id, created_at, updated_at",
  )
  .eq("status", filters.status)
  .is("deleted_at", null);

if (filters.coachProfileId) {
  relationshipQuery = relationshipQuery.eq(
    "coach_profile_id",
    filters.coachProfileId,
  );
}

// DB 단 스코프 사전 필터 (메모리 필터는 아래에서 그대로 유지)
relationshipQuery = applyRelationshipScopeFilter(relationshipQuery, access.scopes);

const { data: relationshipData, error: relationshipError } =
  await relationshipQuery;
```

> `access` 변수는 이미 이 함수 상단에서 `resolveGenealogyAccess()` 결과로 존재한다.
> 추가 파라미터나 구조 변경 없이 바로 참조 가능하다.

---

## Fix 2 — history 쿼리 limit 축소

```typescript
// BEFORE
.limit(5000)

// AFTER
.limit(500)
```

`profile_generation_history` 쿼리의 `.limit(5000)` 한 줄만 변경한다.

---

## 유지할 것 (변경 금지)

아래는 이번 작업에서 건드리지 않는다.

- `relationshipMatchesScope()` 함수 — 메모리 필터로 그대로 유지
- `relationshipMatchesFilters()` 함수 — 그대로 유지
- `profileMatchesScope()` 함수 — 그대로 유지
- `scopedRelationships` 계산 이후 흐름 전체 — 그대로 유지
- `loadAssignData` 함수 — 그대로 유지

DB 필터는 로드량을 줄이는 역할이고, 메모리 필터가 최종 보안 검증을 담당한다.

---

## 타입 규칙

- `any` 사용 금지
- `@ts-ignore` 사용 금지
- `AuthRoleScope` 타입: 이미 파일 상단에 로컬로 정의되어 있음 (import 불필요)
- Supabase query 빌더 타입: `applyRelationshipScopeFilter`의 제네릭 `T`로 처리

---

## 검증 (수정 후 반드시 실행)

```bash
npm run typecheck
npm run check:all
npm run build
```

---

## 수정하지 않을 것

- invitation / acceptance / email 흐름
- auth / role / profile 생성 흐름
- weekly log 흐름
- DB schema / migration / RLS

---

## 완료 후 보고 형식

```
- 수정한 파일: coaching-genealogy.ts
- 추가한 것: applyRelationshipScopeFilter 헬퍼, relationships 쿼리에 스코프 필터 적용
- 변경한 것: history limit 5000 → 500
- 변경하지 않은 것: 메모리 필터 함수들, LOCK 흐름 전체
- typecheck: 통과 / 실패
- check:all: 통과 / 실패
- build: 통과 / 실패
```
