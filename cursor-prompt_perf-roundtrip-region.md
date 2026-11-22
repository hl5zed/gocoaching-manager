# Cursor 작업 명령어 — 성능: 요청당 DB 왕복 지연 줄이기 (리전 점검 + coach-maker 직렬 조회 병렬화)

> ⚠️ **auth/role 인접 영역.** 사용자가 명시적으로 승인한 단일 성능 개선.
> **권한 판정 결과와 오류 우선순위는 바꾸지 않는다** — 서로 독립인 쿼리 2개를 동시에 보내기만 한다.
> Part A는 사람이 대시보드에서 확인하는 작업, Part B만 코드 수정이다. **Part A를 먼저 한다.**

---

## 배경 (병목)

로그인이 필요한 모든 요청(페이지 이동, RSC prefetch, `/api/*`)에서 `src/proxy.ts`가 다음을 **순서대로** 기다린다.

```
getClaims()          ← JWT가 예전 HS256 방식이면 내부적으로 getUser() 네트워크 호출
profiles 조회         (id, status, preferred_locale)
user_roles 조회       ← /coach, /coach-maker, /admin 등 역할 제한 경로만
```

그 뒤 페이지 함수도 profile → roles → 관계 → 데이터를 차례로 기다린다.
결국 화면 하나에 **DB 왕복 5~8번이 차례로** 쌓인다.

`vercel.json`도 `preferredRegion` 설정도 없어서 함수는 Vercel 기본 리전(**미국 동부 iad1**)에서 실행된다.
Supabase가 아시아에 있다면 왕복 한 번이 150~250ms라 그것만으로 1~2초가 된다.
→ **코드보다 리전 일치가 효과가 훨씬 크다.**

---

## Part A — 설정 점검 (코드 수정 없음, 사람이 확인)

### A-1. 리전 일치 확인

1. Supabase 대시보드 → Project Settings → General(또는 Infrastructure)에서 **Region**을 확인한다. 예: Southeast Asia (Singapore), Northeast Asia (Seoul)
2. Vercel 대시보드 → 프로젝트 → Settings → Functions → **Function Region**을 확인한다.
3. 두 리전이 다르면 Vercel Function Region을 Supabase와 같거나 가장 가까운 곳으로 바꾸고 재배포한다.

   | Supabase | Vercel 리전 |
   |---|---|
   | Singapore (ap-southeast-1) | `sin1` |
   | Seoul (ap-northeast-2) | `icn1` |
   | Tokyo (ap-northeast-1) | `hnd1` |

   > 대시보드에서 바꾸면 `vercel.json`을 만들 필요가 없다. 파일로 관리하려면 별도 승인을 받는다(새 파일).

4. 확인 방법: 배포 사이트를 열고 개발자도구 → Network → 문서 요청 → Response Headers → `x-vercel-id`를 본다.
   예: `icn1::sin1::xxxx`에서 **마지막 리전 코드**가 함수 실행 리전이다.

### A-2. JWT 서명 키 방식 확인

- Supabase 대시보드 → Project Settings → **JWT Keys** (또는 API → JWT Settings)를 연다.
- **Legacy JWT secret (HS256)** 만 쓰고 있다면 `proxy.ts`의 `getClaims()`가 로컬 검증을 못 하고 매 요청마다 Auth 서버를 호출한다.
- 새 비대칭 서명 키(ECC P-256 / RS256)로 전환하면 이 호출이 사라진다.
- ⚠️ 전환은 로그인 세션에 영향을 주는 인증 설정 변경이다.
  Supabase 안내에 따라 "새 키 생성 → 대기 → 교체(rotate)" 순서로 진행하고, **legacy 키를 바로 폐기(revoke)하지 않는다.**
  확신이 없으면 이 항목은 건너뛰고 A-1만 한다.

### A-3. 효과 측정

변경 전/후 같은 페이지(`/dashboard`, `/coach-maker`, `/my-coaching`)에서 다음을 비교해 기록한다.
- 개발자도구 Network의 문서 요청 **TTFB(Waiting for server response)**
- Vercel Logs의 `[API_PERFORMANCE]` 단계별 `deltaMs`

---

## Part B — 코드: coach-maker 직렬 조회 병렬화

### 대상

`/coach-maker`, `/coach-maker/report`에서 쓰는 3개 함수는 **profile 조회가 끝난 뒤에야 roles 조회를 시작**한다.
하지만 미들웨어가 검증한 `verifiedProfileId`가 있으면 roles 조회에 필요한 `profile_id`를 이미 알고 있다.
그러니 두 쿼리를 동시에 보낼 수 있다. `/coach-maker/report`는 이 중 두 함수를 함께 호출하므로 양쪽에서 각각 1회씩 왕복이 줄어든다.

| 파일 | 함수 | 위치 |
|---|---|---|
| `src/lib/api/coach-maker/coach-stats.ts` | `getCoachMakerCoachStats` | L460~L510 |
| `src/lib/api/coach-maker/coach-stats.ts` | `getCoachMakerMoksilgiDashboardSummary` | L925~L975 |
| `src/lib/api/coach-maker/moksilgi-progress.ts` | `getCoachMakerMoksilgiProgress` | L1217~L1262 |

### 수정 파일 (2개)

- **EDIT**: `src/lib/api/coach-maker/coach-stats.ts`
- **EDIT**: `src/lib/api/coach-maker/moksilgi-progress.ts`

> `moksilgi-progress.ts`는 `cursor-prompt_perf-moksilgi-progress-overview.md` 작업과 같은 파일이다.
> 수정 위치는 겹치지 않지만, **그 작업을 먼저 끝내고 검증한 뒤** 이 작업을 진행한다.

### 건드리지 않을 것

- `src/proxy.ts`, `src/lib/auth/**` (미들웨어·세션·역할 판정 헬퍼 전부)
- 각 쿼리의 select 컬럼, 필터(`.in("role", …)`, `.eq("status", …)`, `expires_at` 조건 유무 포함), 사용하는 client(`supabase` vs `serviceClient`)
  - 예: `moksilgi-progress.ts`의 roles 쿼리에는 `expires_at` 조건이 없다. **추가하지 말 것** — 결과가 달라진다.
- 오류 코드·메시지와 **검사 순서**: `profileError → !profile → rolesError → 권한 없음`
- `verifiedProfileId`가 없을 때의 기존 경로(`auth_user_id` 조회 후 roles 조회) — 그대로 직렬 유지
- 그 아래의 관계·데이터 조회 로직 전부
- `supabase/**`, `package.json`, 다른 모든 파일
- 작업 트리에 이미 있는 미커밋 변경(`src/lib/api/admin/coaching-relationships.ts`, `next-env.d.ts`)

### 변경 패턴 (3곳 동일하게 적용)

**현재 (직렬):**

```ts
const { data: profile, error: profileError } = verifiedProfileId
  ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
  : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

// … profileError / !profile 검사 …

const currentProfile = profile as CurrentProfileRow;
const { data: roles, error: rolesError } = await serviceClient
  .from("user_roles")
  .select("role, scope_type, scope_id, status")
  .eq("profile_id", currentProfile.id)
  // …기존 필터 그대로…
```

**변경 (verifiedProfileId가 있으면 동시에):**

```ts
// 기존 roles 쿼리를 profileId만 받는 함수로 감싼다. 본문(select·필터)은 한 글자도 바꾸지 않는다.
const buildRolesQuery = (profileId: string) =>
  serviceClient
    .from("user_roles")
    .select("role, scope_type, scope_id, status")
    .eq("profile_id", profileId)
    // …기존 필터 그대로…
    ;

// verifiedProfileId가 있으면 profile과 roles를 Promise.all로 동시에 보낸다.
// 없으면 기존처럼 profile만 먼저 조회한다.
const [profileResult, earlyRolesResult] = verifiedProfileId
  ? await Promise.all([
      profileQuery.eq("id", verifiedProfileId).maybeSingle(),
      buildRolesQuery(verifiedProfileId),
    ])
  : [await profileQuery.eq("auth_user_id", session.user.id).maybeSingle(), null];
const { data: profile, error: profileError } = profileResult;

// … profileError / !profile 검사 (기존 그대로, 기존 순서 그대로) …

const currentProfile = profile as CurrentProfileRow;
const { data: roles, error: rolesError } =
  earlyRolesResult ?? (await buildRolesQuery(currentProfile.id));

// … rolesError 검사 이후 기존 코드 그대로 …
```

### 정확성 근거 (반드시 확인)

- `verifiedProfileId` 경로에서는 profile을 `id = verifiedProfileId`로 조회하므로, profile이 있으면 `currentProfile.id === verifiedProfileId`다.
  → 미리 보낸 roles 쿼리와 기존 roles 쿼리는 **완전히 같은 쿼리**다.
- profile이 없거나 오류이면 기존처럼 그 자리에서 return한다. 미리 보낸 roles 결과는 버려질 뿐이고 응답은 동일하다.
- ⚠️ Supabase 쿼리 빌더는 **`await`(또는 `.then`) 되기 전까지 요청을 보내지 않는다.**
  "변수에 담아 두고 나중에 await" 방식은 병렬이 되지 않는다. 반드시 `Promise.all`로 묶는다.
- Supabase 쿼리는 오류도 `{ data, error }`로 resolve하므로 `Promise.all`이 reject되지 않는다.
  쿼리를 `.then()`으로 감싸 예외를 던지게 만들지 말 것.
- 튜플 타입이 깨지면(`[result, null]` 분기) `const`로 분기 결과를 따로 받는 식으로 정리한다. 캐스팅으로 덮지 말 것.
- 타입: `buildRolesQuery`의 반환 타입은 추론에 맡긴다. `any`·`@ts-ignore`·새 타입 정의 금지.
  결과를 캐스팅하던 기존 타입(`CoachMakerRoleRow[]`, `CurrentRoleRow[]`)을 그대로 쓴다.

---

## 검증

1. 아래 명령 모두 통과:
   ```bash
   npm run typecheck
   npm run check:all
   npm run build
   ```
2. **권한 결과 동일성** (수정 전/후 비교):
   - coach_maker 계정: `/coach-maker`, `/coach-maker/report`, `/coach-maker/moksilgi-progress` 정상 표시, 수치 동일
   - 지역(region) 스코프 coach_maker: 보이는 코치/코치이 목록이 수정 전과 동일
   - super_admin 계정: 전체 범위(`scopeMode: "all"`) 동일
   - coach만 가진 계정: `/coach-maker` 접근 시 기존과 같은 거부 화면
3. Vercel Logs `[API_PERFORMANCE]`의 `/coach-maker/moksilgi-progress`에서 `auth.profile_lookup` → `auth.roles_lookup` 사이 `deltaMs`가 0에 가깝게 줄었는지 확인한다.

## 보고 형식

- Part A: Supabase 리전 / Vercel 리전(변경 전→후) / JWT 키 방식 / TTFB 전후 수치
- Part B: 변경 파일, 바꾼 함수 3개와 라인, 의도적으로 바꾸지 않은 것
- typecheck / check:all / build 결과

---

## 이번 범위 밖 (별도 승인 필요한 후속 후보)

- **같은 패턴의 다른 파일**: `dashboard/me.ts`, `my-coaching/me.ts`, `profile/me.ts`, `coach/action-notes.ts`, `admin/*` 등도 profile → roles를 직렬로 기다린다.
  coach-maker에서 효과와 안전성을 확인한 뒤 파일 1~2개씩 따로 진행한다.
- **미들웨어 profiles + user_roles 한 번에 조회** (embedded select): 왕복 1회가 더 줄지만 `src/proxy.ts`는 인증·권한 핵심이라 별도 검토가 필요하다.
- **user_roles 인덱스 확인**: 미들웨어는 `profile_id`로 조회하지만 저장소 migration에서 확인되는 인덱스는 `(role, profile_id)` 하나뿐이다.
  실제 DB에 `profile_id`로 시작하는 인덱스가 있는지 Supabase SQL Editor에서 확인한다.
  ```sql
  select indexname, indexdef from pg_indexes where tablename = 'user_roles';
  ```
  없으면 migration이 필요하므로 승인 대상이다.
