# Fix 02 — 인증 중복 쿼리 제거

## 현재 문제

관리자 API 요청 1건당 profiles / user_roles 테이블을 **최대 6회** 조회한다.

### 미들웨어 (`middleware.ts`) — 요청마다 실행

| 순서 | 함수 | 쿼리 |
|---|---|---|
| 1 | `supabase.auth.getUser()` | JWT 검증 (1회) |
| 2 | `getCurrentProfileStatus(supabase, user.id)` | `SELECT status FROM profiles WHERE auth_user_id = ?` |
| 3 | `getUserRoles(supabase, user.id)` | `SELECT id FROM profiles WHERE auth_user_id = ?` |
| 4 | (getUserRoles 내부) | `SELECT role FROM user_roles WHERE profile_id = ?` |

profiles를 **2번** 읽는다 (status / id 별도 조회).

### 라우트 핸들러 (`requireAdminProfile()`) — API 핸들러마다 재실행

| 순서 | 함수 | 쿼리 |
|---|---|---|
| 1 | `getSession()` | JWT 재검증 |
| 2 | `getUserRoles(supabase, user.id)` | `SELECT id FROM profiles WHERE auth_user_id = ?` |
| 3 | (getUserRoles 내부) | `SELECT role FROM user_roles WHERE profile_id = ?` |
| 4 | 별도 profiles 조회 | `SELECT id, email FROM profiles WHERE auth_user_id = ?` |

라우트 핸들러에서도 profiles를 **2번** 읽는다.

---

## 작업 목표

두 파일 각각에서 profiles 중복 조회를 제거한다.

1. **`middleware.ts`**: `getCurrentProfileStatus` + `getUserRoles`의 첫 번째 profiles 쿼리를 하나로 합친다.
2. **`src/lib/auth/require-admin-profile.ts`**: `getUserRoles` 호출 + 이후 profiles 재조회를 하나의 profiles 쿼리로 합친다.

---

## 허용 수정 파일

- `middleware.ts`
- `src/lib/auth/require-admin-profile.ts`

**절대 수정 금지:**

- `src/lib/auth/get-user-roles.ts` (다른 곳에서 재사용 중이므로 건드리지 않는다)
- `src/lib/auth/getSession.ts`
- `src/lib/auth/has-role.ts`
- `src/lib/auth/route-access.ts`
- `supabase/` 하위 모든 파일
- auth / invitation / role / profile 생성 흐름
- `package.json`

---

## Fix 1 — `middleware.ts`

### 현재 구조 (문제)

```typescript
// 1. profiles에서 status만 조회
const profileStatus = await getCurrentProfileStatus(supabase, user.id);

// 2. getUserRoles 내부에서 profiles.id 다시 조회 후 user_roles 조회
const userRoles = await getUserRoles(supabase, user.id);
```

### 변경 방법

`getCurrentProfileStatus` 함수를 제거하고, 아래 헬퍼로 교체한다.
`getUserRoles`는 그대로 유지한다.

```typescript
async function getProfileForMiddleware(
  supabase: SupabaseClient<Database>,
  authUserId: string,
): Promise<{ ok: true; profileId: string; status: ProfileStatus | null } | { ok: false }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return { ok: false };
  }

  const row = data as { id: string; status: ProfileStatus };
  return { ok: true, profileId: row.id, status: row.status ?? null };
}
```

그리고 미들웨어 흐름을:

```typescript
// BEFORE
const profileStatus = await getCurrentProfileStatus(supabase, user.id);
if (!profileStatus.ok) { return getRoleErrorResponse(request); }
if (profileStatus.status !== null && profileStatus.status !== "active" && pathname !== "/dashboard") {
  return getDisabledAccountResponse(request);
}
const userRoles = await getUserRoles(supabase, user.id);
```

아래로 교체한다:

```typescript
// AFTER
const profileForMiddleware = await getProfileForMiddleware(supabase, user.id);
if (!profileForMiddleware.ok) { return getRoleErrorResponse(request); }
if (
  profileForMiddleware.status !== null &&
  profileForMiddleware.status !== "active" &&
  pathname !== "/dashboard"
) {
  return getDisabledAccountResponse(request);
}

// getUserRoles는 내부에서 auth_user_id → profile_id 조회를 다시 하지만
// middleware 수준에서는 role 체크만 하면 되므로 기존 함수 유지
const userRoles = await getUserRoles(supabase, user.id);
```

> **참고**: `getUserRoles`가 내부에서 profiles를 한 번 더 읽는 구조는 이번 작업에서 건드리지 않는다.
> 핵심 목표는 `getCurrentProfileStatus`와 첫 번째 `getUserRoles` profiles 조회의 **이중화**를 없애는 것이다.
> `getCurrentProfileStatus` 함수는 완전히 제거한다.

---

## Fix 2 — `src/lib/auth/require-admin-profile.ts`

### 현재 구조 (문제)

```typescript
// 1. getUserRoles → 내부에서 profiles(id) + user_roles 2회 조회
roles = await getUserRoles(supabase, session.user.id);

// 2. 역할 확인 후 profiles를 다시 조회 (id, email)
const { data: profile } = await supabase
  .from("profiles")
  .select("id, email")
  .eq("auth_user_id", session.user.id)
  ...
```

### 변경 방법

`getUserRoles` 호출을 제거하고, profiles + user_roles를 직접 조회하는 코드로 교체한다.

```typescript
// profiles에서 id, email 한 번에 조회
const { data: profileData, error: profileError } = await supabase
  .from("profiles")
  .select("id, email")
  .eq("auth_user_id", session.user.id)
  .neq("status", "anonymized")
  .is("deleted_at", null)
  .maybeSingle();

if (profileError || !profileData) {
  return {
    ok: false,
    status: 403,
    code: "ADMIN_PROFILE_REQUIRED",
    message: "Admin profile could not be resolved.",
  };
}

const profileRecord = profileData as { id: string; email: string | null };

// user_roles를 profile_id로 바로 조회 (profiles 중복 조회 없음)
const { data: rolesData, error: rolesError } = await supabase
  .from("user_roles")
  .select("role")
  .eq("profile_id", profileRecord.id)
  .eq("status", "active")
  .eq("is_active", true)
  .is("deleted_at", null)
  .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

if (rolesError) {
  return {
    ok: false,
    status: 403,
    code: "ADMIN_ROLE_REQUIRED",
    message: "You do not have permission to perform this admin action.",
  };
}

type UserRoleRow = { role: UserRole };
const roles: UserRole[] = ((rolesData ?? []) as UserRoleRow[]).map((r) => r.role);

if (!hasRole(roles, ADMIN_WRITE_ROLES)) {
  return {
    ok: false,
    status: 403,
    code: "ADMIN_ROLE_REQUIRED",
    message: "You do not have permission to perform this admin action.",
  };
}

return {
  ok: true,
  supabase,
  authUserId: session.user.id,
  profile: {
    id: profileRecord.id,
    email: profileRecord.email,
  },
  roles,
};
```

`getUserRoles` import도 함께 제거한다.

---

## 효과 요약

| 위치 | 변경 전 DB 쿼리 수 | 변경 후 DB 쿼리 수 |
|---|---|---|
| middleware | 3 (profiles×2 + user_roles×1) | 2 (profiles×1 + user_roles×1) |
| requireAdminProfile | 3 (profiles×2 + user_roles×1) | 2 (profiles×1 + user_roles×1) |
| **합계** | **6** | **4** |

---

## 타입 규칙

- `any` 사용 금지
- `@ts-ignore` 사용 금지
- `UserRole` 타입: `@/types/database`
- `ProfileStatus` 타입: `@/types/database`

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
- role / profile 생성 흐름
- weekly log 흐름
- dashboard role links
- DB schema / migration / RLS
- `get-user-roles.ts` (다른 흐름에서 사용 중)

---

## 완료 후 보고 형식

```
- 수정한 파일: middleware.ts, require-admin-profile.ts
- 제거한 것: getCurrentProfileStatus 함수, getUserRoles import (require-admin-profile에서만)
- 추가한 것: getProfileForMiddleware 헬퍼, inline profile+roles 조회
- 변경하지 않은 것: LOCK 흐름 전체, get-user-roles.ts
- typecheck: 통과 / 실패
- check:all: 통과 / 실패
- build: 통과 / 실패
```
