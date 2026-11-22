# Cursor 작업 명령어 — F2: 코치메이커 상세·실행메모 profile/roles 조회 병렬화

> ⚠️ **auth/role 인접 영역.** 2차 작업(`1ca1291`)과 같은 패턴을 2개 파일에 더 적용한다.
> **권한 판정 결과와 오류 우선순위는 바꾸지 않는다.**

---

## 배경

아래 두 함수는 profile 조회가 끝난 뒤에야 roles 조회를 시작한다.
미들웨어가 검증한 `verifiedProfileId`가 있으면 두 쿼리를 동시에 보낼 수 있고, 요청마다 DB 왕복 1회가 줄어든다.

| 파일 | 함수 | 사용 화면 |
|---|---|---|
| `src/lib/api/coach-maker/moksilgi-progress-detail.ts` | `getCoachMakerMoksilgiProgressDetail` | `/coach-maker/moksilgi-progress/[planId]` |
| `src/lib/api/coach/action-notes.ts` | `requireActionNotesAccess` | 코치 실행메모 목록·작성·수정·삭제, `/coach-maker/report` |

## 수정 파일 (2개)

- **EDIT**: `src/lib/api/coach-maker/moksilgi-progress-detail.ts`
- **EDIT**: `src/lib/api/coach/action-notes.ts`

## 건드리지 않을 것

- roles 쿼리의 select 컬럼과 필터. 두 파일 모두 `expires_at` 조건이 없다 → **추가하지 말 것.**
- 사용하는 client(`supabase` 사용자 client). serviceClient로 바꾸지 말 것.
- 오류 코드·메시지·HTTP status와 검사 순서(profile 오류/없음 → roles 오류 → 권한 없음)
- `verifiedProfileId`가 없을 때의 기존 순차 경로
- `action-notes.ts`의 `isActiveCoachForTarget`, `canCreateActionNote`, `canSoftDeleteActionNote` 등 권한 판정 함수, 저장 로직 전부
- `src/proxy.ts`, `src/lib/auth/**`, `supabase/**`, `package.json`, 다른 모든 파일

---

## 변경 패턴 (2차 작업과 동일)

```ts
const buildRolesQuery = (rolesProfileId: string) =>
  supabase
    .from("user_roles")
    .select(/* 기존 컬럼 그대로 */)
    .eq("profile_id", rolesProfileId)
    // …기존 필터 그대로…
    ;

// 미들웨어가 검증한 profile id가 있으면 profile과 roles를 동시에 조회한다.
const [profileResult, earlyRolesResult] = await Promise.all([
  verifiedProfileId
    ? profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : profileQuery.eq("auth_user_id", session.user.id).maybeSingle(),
  verifiedProfileId ? buildRolesQuery(verifiedProfileId) : Promise.resolve(null),
]);
const { data: profile, error: profileError } = profileResult;

// … 기존 profile 오류/없음 검사 그대로 …

const { data: roles, error: rolesError } =
  earlyRolesResult ?? (await buildRolesQuery(/* 기존 profile id 변수 */));
```

참고 구현: `src/lib/api/coach-maker/coach-stats.ts`의 `getCoachMakerCoachStats` (커밋 `1ca1291`)

### 정확성 근거

- `verifiedProfileId` 경로에서는 profile을 `id = verifiedProfileId`로 조회한다. 따라서 profile이 있으면 그 id가 `verifiedProfileId`와 같고, 미리 보낸 roles 쿼리는 기존 쿼리와 동일하다.
- `action-notes.ts`는 `profileError || !profile`을 한 번에 검사한다. 이 조건도 그대로 둔다.
- Supabase 쿼리 빌더는 `await` 전까지 요청을 보내지 않는다. 반드시 `Promise.all`로 묶는다.

---

## 검증

1. `npm run typecheck` / `npm run check:all` / `npm run build` 모두 통과
2. 권한 동일성:
   - coach_maker: 목실기 상세 화면 정상, 다른 스코프 사람의 상세 URL을 직접 열면 기존과 같은 거부
   - coach: 실행메모 목록·작성·수정·삭제 정상
   - coachee 전용 계정: 실행메모 API 403(기존과 동일)
3. `/coach-maker/report` 실행메모 영역 수치 동일

## 보고 형식

- 변경 파일·함수·라인
- 의도적으로 바꾸지 않은 것
- typecheck / check:all / build 결과
