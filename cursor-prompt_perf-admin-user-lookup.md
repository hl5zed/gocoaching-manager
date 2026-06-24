# Cursor 작업 명령어 — 성능: admin 직접 등록 시 auth 유저 전체 스캔 제거

> ⚠️ **admin 흐름(관리자 직접 회원 등록).** 사용자가 명시적으로 승인한 단일 성능 개선.
> 한 번에 이 한 가지만. 중복 이메일 **차단 동작은 그대로 유지**하고, O(N) 스캔만 제거한다.

---

## 배경 (병목)

`src/app/api/admin/users/route.ts` 의 `findAuthUserByEmail`는
`auth.admin.listUsers({ page, perPage: 1000 })`를 **최대 50페이지(=최대 50,000명)** 돌며 이메일을 선형 탐색한다. 사용자 수가 늘수록 admin 직접 등록이 느려지고 API timeout 위험이 있다.

## 핵심 분석 (왜 단순 profiles 조회로 못 바꾸나)

이 함수 **바로 위**에서 `profiles` 이메일 중복은 이미 검사한다(`existingProfile` → `registered_profile`).
`findAuthUserByEmail`의 목적은 그와 다르다 — **프로필이 없는 고아 auth 유저**(auth.users엔 있지만 profiles엔 없는 계정)를 잡는 것. 그래서 `profiles` 조회로 대체하면 목적이 깨진다.

## 해결 방향 (권장)

`createUser`는 **이미 원자적으로 중복 이메일을 거부**하며, 그 에러는 같은 파일의 `isDuplicateAuthUserError(authError)` 분기에서 동일하게 `"auth_without_profile"`로 매핑된다(L1579 부근, 확인 완료).
즉 사전 스캔은 `createUser`의 내장 검사와 **사실상 중복**이다.

→ **O(N) 사전 스캔을 제거하고 `createUser`의 중복 처리에 위임**한다. DB 쿼리·스키마·RLS 변경이 전혀 없고, 중복 차단 결과(같은 에러 코드)도 보존된다.

---

## 수정 파일 (정확히 1개)

- **EDIT**: `src/app/api/admin/users/route.ts`

## 건드리지 않을 것

- `createUser` 호출 및 그 에러 분기(`isDuplicateAuthUserError`, `auth_create_failed`) — 그대로 유지
- 그 위의 `profiles` 중복 검사(`existingProfile`) — 그대로 유지
- profile insert 로직, role 부여 로직
- `supabase/**`, RLS, `package.json`

---

## Step 1 — 사전 스캔 호출부 제거

파일: `src/app/api/admin/users/route.ts` (L1555 부근)

아래 블록을 **삭제**한다:

```ts
  const authUserLookup = await findAuthUserByEmail(typedAdminClient, email);

  if (authUserLookup === "failed") {
    return redirectWithError(request, "auth", "auth_lookup_failed");
  }

  if (authUserLookup === "found") {
    console.error("[ADMIN_USERS_CREATE_DUPLICATE_EMAIL] auth user already exists");
    return redirectWithError(request, "auth", "auth_without_profile");
  }
```

삭제 후, 바로 다음의 `createUser` 호출이 이어진다. 중복 auth 유저는 `createUser`가 에러를 반환하고, 기존 `isDuplicateAuthUserError(authError)` 분기가 `"auth_without_profile"`로 처리한다(동작 보존).

## Step 2 — 이제 미사용이 된 헬퍼 정리

`findAuthUserByEmail`를 지우면 `normalizeAuthEmail`도 미사용이 된다(이 둘만 서로 사용 — 확인 완료). `AuthUserLookupResult` 타입도 미사용이 된다.

아래를 **삭제**한다:

- `async function findAuthUserByEmail(...) { ... }` 전체 (L1170 부근)
- `function normalizeAuthEmail(...) { ... }` 전체 (L1166 부근)
- `type AuthUserLookupResult = "found" | "not_found" | "failed";` (L119 부근)

> `isDuplicateAuthUserError`는 **남겨둔다**(createUser 에러 분기에서 계속 사용).
> tsconfig에 `noUnusedLocals`가 없어 안 지워도 빌드는 통과하지만, 죽은 코드 제거를 위해 함께 삭제 권장.

---

## (참고) 대안 — 사전 스캔을 굳이 유지하고 싶다면

고아 auth 유저를 등록 **이전에** 양성 검출하고 싶다면, `auth.users`를 이메일로 직접 조회하는 `SECURITY DEFINER` RPC를 추가하는 방법이 있다. 단 이는 **DB 변경(migration)**이 필요하므로 이 명령 범위 밖이며 별도 승인이 필요하다. 권장안은 위의 "제거 + createUser 위임"이다.

---

## Step 3 — 검증 (필수)

```bash
npm run typecheck
npm run check:all
npm run build
```

가능하면: (a) 신규 이메일 직접 등록 정상 동작, (b) 이미 존재하는 이메일로 등록 시 `auth_without_profile` 에러로 차단되는지 로컬 확인.

---

## 반환 (보고할 것)

- 변경 파일 (정확히 1개)
- 삭제한 심볼 목록(findAuthUserByEmail / normalizeAuthEmail / AuthUserLookupResult)
- typecheck / check:all / build 통과 여부
- 중복 이메일 차단 동작 확인 결과

## 한 줄 요약

> 최대 5만 명 선형 스캔 제거 → createUser의 원자적 중복 검사에 위임. 중복 차단 결과(에러 코드)는 동일.
