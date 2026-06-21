# Fix 05 — 인메모리 캐시 스테일 문제 해결

## 현재 문제

`src/lib/api/admin/users.ts`에 세 개의 모듈 레벨 `Map` 캐시가 있다.

| 캐시 | TTL | 용도 |
|---|---|---|
| `lookupNameCache` | 3분 | 조직/교회/그룹/지역 이름 |
| `countryLookupCache` | 3분 | 국가 이름·코드 |
| `adminUserRoleSummaryCache` | 1분 | 역할별 회원 카운트 |

**문제:**
- 모듈 전역 `Map`은 서버리스 환경에서 인스턴스별로 독립 동작한다.
- 역할 추가/변경/상태 변경 직후, 다른 인스턴스는 최대 TTL만큼 옛 카운트를 보여준다.
- 코드 주석도 이 지연 가능성을 인정하고 있다.

---

## 접근 방식

### `adminUserRoleSummaryCache` — `unstable_cache` + `revalidateTag` 교체

회원 카운트는 역할 변경 즉시 반영이 중요하다.
Next.js의 `unstable_cache`는 Vercel Data Cache를 사용하고
`revalidateTag`로 인스턴스 간 동기화된 무효화가 가능하다.

### `lookupNameCache` / `countryLookupCache` — TTL 3분 → 60초 단축

조직명·국가명은 보안 무관 표시 데이터다.
인스턴스별 캐시로 충분하며, TTL만 줄여 지연 창을 축소한다.

---

## 허용 수정 파일

- `src/lib/api/admin/users.ts`
- `src/app/api/admin/users/route.ts`

**절대 수정 금지:**
- `supabase/` 하위 모든 파일
- auth / role / invitation / profile 생성 흐름의 핵심 로직
- `package.json`

---

## Fix 1 — `users.ts`: `adminUserRoleSummaryCache` 교체

### 제거할 것

```typescript
// 아래 세 줄 제거
const adminUserRoleSummaryCache = new Map<
  string,
  AdminUserRoleSummaryCacheEntry
>();
const USER_ROLE_SUMMARY_CACHE_TTL_MS = 60 * 1000;
const USER_ROLE_SUMMARY_CACHE_KEY = "global";

// AdminUserRoleSummaryCacheEntry 타입도 제거
type AdminUserRoleSummaryCacheEntry = {
  expiresAt: number;
  value: AdminUserRoleSummaryCounts;
};

// cloneUserRoleSummary 함수가 adminUserRoleSummaryCache 외에 사용되지 않으면 제거
function cloneUserRoleSummary(value: AdminUserRoleSummaryCounts) { ... }
```

### 추가할 것

파일 상단 import에 추가:

```typescript
import { unstable_cache } from "next/cache";
```

`getAdminUserRoleSummary` 함수 내부의 캐시 체크 + 저장 로직을 제거하고,
DB 조회 로직만 별도 함수로 추출한 뒤 `unstable_cache`로 감싼다.

```typescript
// DB 조회 로직만 순수하게 추출
async function fetchAdminUserRoleSummaryFromDb(): Promise<{
  summary: AdminUserRoleSummaryCounts;
  error: string | null;
}> {
  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    return {
      summary: createEmptyRoleSummaryCounts(),
      error: "Unable to load user summary right now.",
    };
  }

  const client = serviceClient;
  const roleTargets: Array<{
    role: UserRole;
    key: keyof Omit<AdminUserRoleSummaryCounts, "totalProfiles">;
  }> = [
    { role: "coachee", key: "coacheeCount" },
    { role: "coach", key: "coachCount" },
    { role: "coach_maker", key: "coachMakerCount" },
    { role: "church_admin", key: "churchAdminCount" },
    { role: "organization_admin", key: "organizationAdminCount" },
    { role: "super_admin", key: "superAdminCount" },
  ];

  const [profileCountResult, ...roleCountResults] = await Promise.all([
    client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    ...roleTargets.map((target) => countActiveUserRole(client, target.role)),
  ]);

  if (profileCountResult.error) {
    return {
      summary: createEmptyRoleSummaryCounts(),
      error: profileCountResult.error.message,
    };
  }

  const failedRoleCount = roleCountResults.find((result) => result.errorMessage);
  if (failedRoleCount?.errorMessage) {
    return {
      summary: createEmptyRoleSummaryCounts(),
      error: failedRoleCount.errorMessage,
    };
  }

  const summary = createEmptyRoleSummaryCounts();
  summary.totalProfiles = profileCountResult.count ?? 0;
  roleCountResults.forEach((result, index) => {
    summary[roleTargets[index].key] = result.count;
  });

  return { summary, error: null };
}

// unstable_cache로 감싸기
// tags: 무효화 시 revalidateTag("admin-user-role-summary")로 즉시 갱신
// revalidate: 60 = 최대 60초 TTL (revalidateTag 없이도 자동 만료)
const getCachedAdminUserRoleSummary = unstable_cache(
  fetchAdminUserRoleSummaryFromDb,
  ["admin-user-role-summary"],
  { tags: ["admin-user-role-summary"], revalidate: 60 },
);
```

`getAdminUserRoleSummary` 함수는 캐시 호출만 하도록 단순화:

```typescript
export async function getAdminUserRoleSummary(
  perf?: AdminUserPerformanceLogger,
): Promise<{
  summary: AdminUserRoleSummaryCounts;
  error: string | null;
}> {
  const result = await getCachedAdminUserRoleSummary();
  perf?.mark("summary.complete", result.summary.totalProfiles);
  return result;
}
```

---

## Fix 2 — `users.ts`: lookup 캐시 TTL 단축

```typescript
// BEFORE
const LOOKUP_CACHE_TTL_MS = 3 * 60 * 1000;  // 3분

// AFTER
const LOOKUP_CACHE_TTL_MS = 60 * 1000;  // 60초
```

한 줄 변경이다. `lookupNameCache`와 `countryLookupCache` 모두 이 상수를 공유하므로 함께 적용된다.

---

## Fix 3 — `route.ts`: 뮤테이션 성공 후 `revalidateTag` 호출

파일 상단 import에 추가:

```typescript
import { revalidateTag } from "next/cache";
```

아래 네 핸들러의 **성공 반환 직전**에 `revalidateTag("admin-user-role-summary")`를 추가한다.

### `handleRoleAdd` 성공 경로

```typescript
// role insert 성공 후
// BEFORE
return getAdminUsersRedirectWithMessage(request, { role_added: "1" });

// AFTER
revalidateTag("admin-user-role-summary");
return getAdminUsersRedirectWithMessage(request, { role_added: "1" });
```

### `handleRoleUpdate` 성공 경로

역할 업데이트(활성화/비활성화 포함)가 성공한 반환 직전에 동일하게 추가:

```typescript
revalidateTag("admin-user-role-summary");
return getAdminUsersRedirectWithMessage(request, { ... });
```

### `handleStatusUpdate` 성공 경로 (프로필 상태 변경)

```typescript
revalidateTag("admin-user-role-summary");
return getAdminUsersRedirectWithMessage(request, { ... });
```

### `handleCreateProfile` 성공 경로 (프로필 신규 생성, 있는 경우)

intent `"create_profile"`이 성공하는 경로에도 동일하게 추가.

> **주의**: 실패/에러 반환 경로에는 추가하지 않는다. 성공 분기에만 추가한다.

---

## 타입 규칙

- `any` 사용 금지
- `@ts-ignore` 사용 금지
- `unstable_cache` / `revalidateTag` import 출처: `"next/cache"`

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
- auth / role / profile 생성 핵심 로직
- weekly log 흐름
- DB schema / migration / RLS
- `AdminUserRoleSummaryCounts` 타입 (유지)
- `createEmptyRoleSummaryCounts` 함수 (유지 — `getAdminUserRoleSummary`에서 계속 사용)
- `countActiveUserRole` 함수 (유지)

---

## 완료 후 보고 형식

```
- 수정한 파일: users.ts, route.ts
- 제거한 것: adminUserRoleSummaryCache Map, AdminUserRoleSummaryCacheEntry 타입, cloneUserRoleSummary (미사용 시)
- 추가한 것: fetchAdminUserRoleSummaryFromDb, getCachedAdminUserRoleSummary(unstable_cache), revalidateTag 호출 4곳
- 변경한 것: LOOKUP_CACHE_TTL_MS 3분 → 60초
- typecheck: 통과 / 실패
- check:all: 통과 / 실패
- build: 통과 / 실패
```
