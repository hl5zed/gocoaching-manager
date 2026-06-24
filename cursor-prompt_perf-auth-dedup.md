# [설계] 미들웨어 ↔ 페이지 인증 중복 제거 (안전 단계별)

> 작성: 2026-06-24 · 성능 설계 문서 (바로 실행용 아님 — 단계별 승인 후 적용)
> LOCK 인접(auth/role/profile). 각 Stage는 **독립적으로** 적용·롤백 가능하도록 설계함.
> 원칙: 인증/권한 **판정 규칙은 변경하지 않는다.** 같은 요청 안에서 이미 끝난 검증을 **재사용**해 왕복만 줄인다.

---

## 1. 문제 정량화 (보호 페이지 1회 진입 기준)

| 단계 | 위치 | 비용 |
|---|---|---|
| getUser ①  | `middleware.ts` `supabase.auth.getUser()` | **Auth 서버 네트워크 왕복** |
| profiles ① | `middleware.ts` `getProfileForMiddleware` | DB |
| user_roles ① | `middleware.ts` `getRolesByProfileId` (role-gated 경로만) | DB |
| getUser ②  | 페이지 `getSession()` → `auth.getUser()` | **Auth 서버 네트워크 왕복(중복)** |
| profiles ② | `getMyCoachingMe` / `requireAdminProfile` 의 `profiles` 조회 | DB(중복) |
| user_roles ② | 위 헬퍼의 `user_roles` 조회 | DB |

핵심 낭비: **getUser ②** (원격 JWT 재검증 왕복)와 **profiles ②**.
`getSession`은 `cache()`로 같은 렌더 내 1회지만, **middleware ↔ 페이지 경계는 캐시되지 않음** → 같은 요청에서 getUser가 2번 원격 왕복.

> 보안 관점: getUser ②가 하는 "원격 재검증"은 **같은 요청에서 middleware가 이미 수행**했다. 그 검증 결과를 페이지로 넘기는 것은 보안 약화가 아니라 중복 제거다(아래 §4 조건 충족 시).

---

## 2. 메커니즘 — Next.js request header 전달

미들웨어는 검증된 식별자를 **요청 헤더**로 실어 다운스트림(서버 컴포넌트/route handler)에 넘길 수 있다:

```ts
// middleware: 검증 성공 후
const requestHeaders = new Headers(request.headers);
// ① 클라이언트가 위조해 보낸 동일 헤더를 먼저 제거 (스푸핑 차단 — 필수)
requestHeaders.delete("x-gothrive-auth-user-id");
requestHeaders.delete("x-gothrive-profile-id");
requestHeaders.delete("x-gothrive-profile-status");
// ② 검증된 값만 세팅
requestHeaders.set("x-gothrive-auth-user-id", user.id);
requestHeaders.set("x-gothrive-profile-id", profileForMiddleware.profileId);
if (profileForMiddleware.status) {
  requestHeaders.set("x-gothrive-profile-status", profileForMiddleware.status);
}
// ③ 이 헤더를 단 요청으로 다운스트림 전달
//    (쿠키 setAll이 response를 재생성하므로, requestHeaders를 supabase client factory에
//     주입해 동일 요청 객체를 쓰게 하는 방식 권장 — §6 구현 노트)
```

페이지/route에서 읽기:

```ts
import { headers } from "next/headers";
const h = await headers();
const verifiedUserId = h.get("x-gothrive-auth-user-id"); // 있으면 신뢰, 없으면 fallback
```

---

## 3. 단계별 계획 (위험 낮음 → 높음, 각 Stage 독립)

### Stage A — getSession 중앙 단축 (가장 작은 변경 / 큰 효과)
**아이디어:** 모든 페이지·헬퍼가 `getSession()` 하나로 인증한다(호출처 ~63곳). 그 한 곳이 미들웨어 헤더를 우선 사용하면 **모든 호출처가 자동으로 getUser ② 왕복을 건너뛴다.**

- `getSession()`: `x-gothrive-auth-user-id` 헤더가 있으면 그 값으로 `{ user: { id, email } }` 반환, **getUser() 호출 생략.** 헤더가 없으면(=매처 밖 경로 등) 기존 `auth.getUser()` 경로로 **fallback**.
  - email이 필요하면 헤더에 `x-gothrive-auth-email`도 함께 전달(미들웨어 user.email).
- 효과: 보호 경로에서 **getUser 원격 왕복 2→1회.** profiles/user_roles는 그대로(Stage B에서).
- 수정 파일(2): `middleware.ts`(헤더 set/strip), `src/lib/auth/getSession.ts`(헤더 우선 + fallback).
- 위험: 낮음. 판정 규칙 불변, 헤더 없으면 기존 동작. **단, §4 스푸핑 차단 필수.**

### Stage B — profiles ② 제거 (profileId 헤더 재사용)
**아이디어:** 미들웨어가 이미 구한 `profileId`를 헤더로 넘겨, 페이지 헬퍼가 `auth_user_id → profiles.id` 재조회를 생략.

- 신규 헬퍼 `src/lib/auth/verified-identity.ts`: `getVerifiedProfileId()` = 헤더 `x-gothrive-profile-id` 읽기(없으면 null).
- `getMyCoachingMe`(me.ts) / `requireAdminProfile`: profileId 헤더가 있으면 profiles 조회를 **id로 1회**만 하거나(이메일/표시명 등 컬럼 필요 시), role/relationship 조회의 `eq("profile_id", …)`에 헤더값을 바로 사용. 헤더 없으면 기존 경로.
- 효과: profiles **2→1회**(또는 by-id 단축). 
- 위험: 중간. me.ts는 LOCK(my-coaching) 인접 → **명시 승인 + 동작 동등성(필터 deleted_at/status, 반환 컬럼) 검증 필수.**

### Stage C — user_roles 전달 (선택, 한계효용 낮음)
role-gated 경로에서 미들웨어가 이미 조회한 roles를 헤더(JSON)로 전달해 페이지 재조회 생략. 가치 작고 직렬화/만료 처리 부담 → **권장 보류.**

---

## 4. 보안 체크리스트 (Stage A/B 공통, 반드시 충족)

1. **스푸핑 차단:** 미들웨어가 `requestHeaders.delete(...)`로 **클라이언트發 동일 헤더를 먼저 제거**한 뒤 검증값만 set. (이게 빠지면 클라가 임의 user_id 주입 가능 → 치명적.)
2. **세팅 시점:** 헤더는 `auth.getUser()` 성공 + profiles 확인 **이후**에만 set. 실패 경로(401/403/redirect)에서는 set하지 않음.
3. **fallback 안전:** 헤더 부재 시 항상 기존 getUser/profiles 경로로 동작 → 매처 밖·공개 경로(login 등)에서 깨지지 않음.
4. **매처 일치:** 보호 페이지가 모두 `middleware.config.matcher`에 포함되는지 확인(현재 static asset만 제외 → 포함됨). 공개 경로(`isPublicRoute`)는 헤더 미설정이므로 fallback 사용.
5. **상태(status) 일관성:** `x-gothrive-profile-status`로 비활성 계정 처리 로직을 **추가로 우회하지 말 것** — 판정은 기존 위치 유지, 헤더는 조회 절약용으로만.

---

## 5. 권장 적용 순서

1. **Stage A만 단독 적용 → 검증 → 1~2일 관찰** (getUser 왕복 절반 제거, 위험 최소).
2. 안정 확인 후 **Stage B를 my-coaching 페이지 1곳에 파일럿** → 동작 동등성 확인 → 점진 확대.
3. Stage C는 보류.

> CLAUDE.md의 "한 번에 한 기능 / 1~4 파일 / LOCK 승인" 원칙상 Stage는 **절대 합치지 말 것.**

---

## 6. 구현 노트 (Stage A 정확 적용)

`middleware.ts`의 쿠키 `setAll`이 `NextResponse.next({ request })`로 response를 재생성하므로, request 헤더를 확실히 싣는 가장 안전한 방법:

- `createMiddlewareSupabaseClient(request, requestHeaders)`로 **수정된 헤더를 주입**하고, 내부 `NextResponse.next`가 `{ request: { headers: requestHeaders } }`를 쓰게 한다.
- 단, 헤더 값(user.id 등)은 getUser 성공 후에야 알 수 있다 → 순서상 (a) 빈 requestHeaders로 client 생성·getUser → (b) 성공 시 requestHeaders에 검증값 set → (c) **최종 허용 응답을 `NextResponse.next({ request: { headers: requestHeaders } })`로 한 번 더 생성**하고, supabase가 세팅한 **쿠키들을 그 응답에 복사** + `applySecurityHeaders`.
  - 쿠키 복사: `supabaseResponse.cookies.getAll().forEach(c => finalResponse.cookies.set(c))`.
- redirect/에러 응답 경로에는 **헤더를 싣지 않는다.**

`getSession.ts` (Stage A):

```ts
import { headers } from "next/headers";
export const getSession = cache(async function getSession() {
  const h = await headers();
  const headerUserId = h.get("x-gothrive-auth-user-id");
  if (headerUserId) {
    return { user: { id: headerUserId, email: h.get("x-gothrive-auth-email") }, error: null };
  }
  // ── fallback: 기존 auth.getUser() 경로 그대로 ──
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  ...
});
```

---

## 7. 검증 / 롤백

검증(각 Stage 후):
- `npm run typecheck`, `npm run check:all`, 본인 PC에서 `npm run build`
- 수동 시나리오: ① 정상 로그인 후 보호 페이지 진입 ② 로그아웃 상태 진입(→login redirect) ③ 비활성(suspended) 계정 ④ role 부족 계정(→/unauthorized) ⑤ 매처 밖/공개 경로(login)에서 정상 ⑥ 위조 헤더를 직접 보내도 무시되는지(curl로 `x-gothrive-auth-user-id` 주입 테스트).

롤백: 각 Stage는 2~3개 파일 변경이므로 해당 커밋 revert로 즉시 원복. Stage 간 의존 없음(B는 A 없이도 독립 동작 가능하나, A→B 순서 권장).

---

## 8. 예상 효과 요약

| 항목 | 현재 | Stage A 후 | Stage A+B 후 |
|---|---|---|---|
| getUser 원격 왕복 / 요청 | 2 | **1** | 1 |
| profiles 조회 / 요청 | 2 | 2 | **1** |
| user_roles 조회 / 요청 | 1~2 | 1~2 | 1~2 |

가장 큰 체감 개선은 Stage A(원격 Auth 왕복 절반 제거). Stage B는 DB 왕복 1회 추가 절감.
