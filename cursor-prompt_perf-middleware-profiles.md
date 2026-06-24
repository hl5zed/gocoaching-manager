# Cursor 작업 명령어 — 성능: middleware profiles 중복 조회 제거

> ⚠️ **LOCK 인접(auth 흐름).** 이 명령은 사용자가 명시적으로 승인한 단일 성능 개선이다.
> 한 번에 이 한 가지만 처리한다. 인증/역할 **판정 규칙**은 바꾸지 않는다 — DB 왕복 횟수만 줄인다.

---

## 배경 (병목)

모든 보호된 요청마다 `profiles` 테이블을 **2번** 조회한다.

1. `middleware.ts` → `getProfileForMiddleware(supabase, user.id)` : `profiles`에서 `id, status` 조회
2. 직후 `getUserRoles(supabase, user.id)` 내부에서 **다시** `profiles`를 `auth_user_id`로 조회해 `id`를 구한 뒤 `user_roles` 조회

즉 보호 요청 1건당 `auth.getUser` + `profiles` ×2 + `user_roles` ×1. `profiles` 조회가 동일 `auth_user_id`로 중복된다.

## 해결 방향

middleware는 1번에서 이미 `profileId`를 갖고 있다. `user_roles`만 조회하는 **추가 함수**를 만들어 그 `profileId`를 재사용한다. 기존 `getUserRoles` 시그니처는 **그대로 둔다**(다른 호출부 `system-announcements.ts` 영향 없음 — 확인 완료).

결과: 요청당 `profiles` 조회 2→1회.

---

## 수정 파일 (정확히 2개)

- **ADD(함수 추가)**: `src/lib/auth/get-user-roles.ts`
- **EDIT**: `middleware.ts`

## 건드리지 않을 것

- 기존 `getUserRoles` 함수 본문/시그니처 (그대로 유지)
- `src/lib/auth/has-role.ts`, `route-access.ts`
- `profiles` / `user_roles` 의 **필터 조건**(status='active', is_active, deleted_at, expires_at) — 동일하게 복제만 한다
- `supabase/**`, RLS, `package.json`

---

## Step 1 — get-user-roles.ts 에 `getRolesByProfileId` 추가

파일: `src/lib/auth/get-user-roles.ts`

기존 `getUserRoles` 함수는 **그대로 두고**, 파일 하단에 아래 함수를 **추가**한다. `user_roles` 쿼리는 기존 `getUserRoles`의 것과 **완전히 동일한 필터**를 사용한다(동작 일치 보장).

```ts
/**
 * profile_id를 이미 아는 경우 profiles 재조회 없이 user_roles만 조회한다.
 * middleware처럼 직전에 profiles를 1회 조회한 경로에서 중복 조회를 제거하기 위함.
 * getUserRoles 내부 user_roles 쿼리와 동일한 필터를 사용한다.
 */
export async function getRolesByProfileId(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<UserRole[]> {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    throw new Error("ROLE_QUERY_FAILED");
  }

  return ((roles ?? []) as UserRoleRow[]).map((role) => role.role);
}
```

> `UserRoleRow`, `SupabaseClient`, `Database`, `UserRole` 은 파일 상단에 이미 import/정의돼 있으니 추가 import 불필요.

## Step 2 — middleware.ts 에서 재사용

파일: `middleware.ts`

(1) import 변경:

```ts
// 변경 전
import { getUserRoles } from "@/lib/auth/get-user-roles";
// 변경 후 (getRolesByProfileId 추가 — getUserRoles는 다른 곳에서 안 쓰므로 교체해도 됨)
import { getRolesByProfileId } from "@/lib/auth/get-user-roles";
```

(2) 역할 조회 호출부 변경. 이 시점에 `profileForMiddleware.profileId`가 이미 확보돼 있다.

```ts
// 변경 전
const userRoles = await getUserRoles(supabase, user.id);
// 변경 후
const userRoles = await getRolesByProfileId(supabase, profileForMiddleware.profileId);
```

다른 줄(상태 체크, allowedRoles, hasRole 분기)은 **그대로 둔다.**

---

## 동작 동일성 확인 포인트

- `getProfileForMiddleware`는 `deleted_at IS NULL`로 프로필을 찾고, middleware가 `status !== 'active'`를 이미 차단한다. 따라서 `getRolesByProfileId`에 넘기는 `profileId`는 유효한 활성 프로필이다.
- 한 가지 edge case: 기존 `getUserRoles`의 profiles 쿼리는 `status != 'anonymized'`도 걸렀다. 새 경로는 status 차단을 middleware 상위 분기가 담당한다. anonymized 계정이 `/dashboard`에 접근하는 희귀 케이스에서 역할이 조회될 수 있으나, anonymized 계정은 활성 역할이 없으므로 실질 영향 없음. 구현 후 이 케이스를 한 번 점검할 것.

---

## Step 3 — 검증 (필수)

```bash
npm run typecheck
npm run check:all
npm run build
```

가능하면 로컬에서 보호 페이지 1개 + admin API 1개를 실제 호출해 정상 동작(접근 허용/차단)이 기존과 같은지 확인한다.

---

## 반환 (보고할 것)

- 변경 파일 목록 (정확히 2개)
- `getRolesByProfileId` 추가 위치
- typecheck / check:all / build 통과 여부
- anonymized edge case 점검 결과

## 한 줄 요약

> middleware가 이미 가진 profileId를 재사용해 `user_roles`만 조회 → 요청당 profiles 조회 2→1회. 인증/역할 판정 규칙은 불변.
