# Fix 01 — Admin Scope Leak (users & invitations)

## 배경

`getAdminUsers` (`src/lib/api/admin/users.ts`)와
`getAdminInvitations` (`src/lib/api/admin/invitations.ts`)는
현재 service role 클라이언트(RLS 우회)를 쓰면서
**관리자의 scope_type / scope_id 기반 필터가 전혀 없다.**

결과적으로 `church_admin` 계정으로 `/admin/users`에 접근하면
자기 교회 소속이 아닌 전 세계 모든 프로필·초대 레코드가 노출된다.

참고: `src/lib/api/admin/coaching-genealogy.ts`의
`profileMatchesScope()` / `relationshipMatchesScope()` 함수가
올바른 스코프 필터 패턴을 보여준다. 동일한 방식을 적용한다.

---

## 작업 목표

`getAdminUsers`와 `getAdminInvitations`가
호출자의 관리자 스코프를 읽어 DB 쿼리 단계에서 필터링하도록 수정한다.

---

## 허용 수정 파일

- `src/lib/api/admin/users.ts`
- `src/lib/api/admin/invitations.ts`

**아래 파일은 절대 수정하지 않는다:**

- `src/lib/api/admin/coaching-genealogy.ts`
- `supabase/` 하위 모든 파일 (migration, RPC, schema)
- `src/middleware.ts`
- auth / role / profile 흐름 관련 파일
- `package.json`

---

## 스코프 필터 로직 명세

관리자의 스코프는 `admin.profile.scope_type` / `admin.profile.scope_id`로 읽는다.
(`requireAdminProfile()` 반환값의 `.profile` 필드 참조)

### profiles 테이블 필터 (`getAdminUsers`)

| admin scope_type | 적용할 WHERE 조건 |
|---|---|
| `global` | 필터 없음 (전체 허용) |
| `country` | `country_id = scope_id` |
| `region` | `region_id = scope_id` |
| `organization` | `organization_id = scope_id` |
| `church` | `church_id = scope_id` |
| 기타 / scope_id 없음 | 결과 0건 반환 (안전 기본값) |

### invitations 테이블 필터 (`getAdminInvitations`)

invitations 테이블에는 `scope_type` / `scope_id` 컬럼이 있다.

| admin scope_type | 적용할 WHERE 조건 |
|---|---|
| `global` | 필터 없음 |
| 나머지 | `scope_type = admin.scope_type AND scope_id = admin.scope_id` |
| scope_id 없음 | 결과 0건 반환 |

---

## `getAdminUsers` 수정 방법

1. 함수 시그니처에 `authorizedAdmin` 파라미터가 이미 있으므로 유지한다.
2. `admin.ok` 체크 이후, `profilesQuery` 빌드 직전에 아래 블록을 삽입한다:

```typescript
// --- scope filter ---
const adminScope = admin.profile; // { scope_type, scope_id, ... }

if (adminScope.scope_type !== "global") {
  if (!adminScope.scope_id) {
    // scope_id가 없으면 안전하게 빈 결과 반환
    perf.mark("complete", 0);
    return {
      users: [],
      summary: createEmptySummary(),
      error: null,
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  const scopeColumn: Record<string, string> = {
    country: "country_id",
    region: "region_id",
    organization: "organization_id",
    church: "church_id",
  };

  const col = scopeColumn[adminScope.scope_type];
  if (!col) {
    perf.mark("complete", 0);
    return {
      users: [],
      summary: createEmptySummary(),
      error: null,
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  profilesQuery = profilesQuery.eq(col, adminScope.scope_id);
}
// --- end scope filter ---
```

---

## `getAdminInvitations` 수정 방법

1. 함수 시그니처에 `authorizedAdmin` 파라미터를 추가한다.
   - 타입: `AuthorizedAdminProfile` (users.ts에서 import하거나 공통 타입에서 가져온다)
   - 선택적(`?`)으로 선언하고, 없으면 `requireAdminProfile()`을 호출한다.

2. service client 초기화 이후, `let query = ...` 빌드 직전에 아래 블록을 삽입한다:

```typescript
// --- scope filter ---
const adminScope = admin.profile;

if (adminScope.scope_type !== "global") {
  if (!adminScope.scope_id) {
    return {
      invitations: [],
      error: null,
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }
  query = query
    .eq("scope_type", adminScope.scope_type)
    .eq("scope_id", adminScope.scope_id);
}
// --- end scope filter ---
```

---

## 타입 규칙

- `any` 사용 금지
- `@ts-ignore` 사용 금지
- `AuthorizedAdminProfile` 타입 출처: `src/lib/api/admin/users.ts` (이미 export됨)
- DB 컬럼명은 `src/types/database.ts` 기준

---

## 검증 (수정 후 반드시 실행)

```bash
npm run typecheck
npm run check:all
npm run build
```

결과를 보고할 것:
- typecheck 통과 여부
- check:all 통과 여부
- build 통과 여부

---

## 수정하지 않을 것

- invitation creation / acceptance / email 흐름
- auth / role / profile 생성 흐름
- weekly log 관련 흐름
- dashboard role links
- DB schema / migration / RLS

---

## 완료 후 보고 형식

```
- 수정한 파일: users.ts, invitations.ts
- 추가된 동작: 관리자 scope 기반 DB 쿼리 필터
- 변경하지 않은 것: LOCK 흐름 전체
- typecheck: 통과 / 실패
- check:all: 통과 / 실패
- build: 통과 / 실패
```
