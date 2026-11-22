# Codex/Cursor 작업 명령어 — 목실기 진행현황 관계 표 권한 범위 폴백 수정

> ⚠️ **권한 범위(데이터 노출) 수정.** AI_WORKFLOW 기준 **Codex 담당**(기존 기능 안정화).
> 한 번에 이 한 가지만. **정상 경우의 결과는 그대로 두고**, 사전 필터가 꺼지는 경우에만 범위 밖 관계가 섞이지 않게 막는다.

---

## 문제

`src/lib/api/coach-maker/moksilgi-progress.ts` · `getCoachMakerMoksilgiProgress`의 **넓은 범위(broad) 경로** 문제다.

### 영향받는 역할

| 역할 | 경로 | 이 문제 해당 |
|---|---|---|
| super_admin | broad, `hasFullRelationshipAccess` → 전체 관계(의도된 동작) | ❌ |
| organization_admin, country_admin | broad, 스코프 사전 필터 | ✅ **해당** |
| coach_maker, church_admin | 직접 코칭 관계만(`coach_profile_id = 본인`) | ❌ |

> 이전 로드맵에 "지역 스코프 coach_maker"라고 적었던 것은 잘못이다. 실제 해당 역할은 **organization_admin·country_admin**이다.

### 현재 동작

관계 조회는 DB 사전 필터만으로 범위를 제한한다. **메모리에서 다시 거르는 단계가 없다.**

```
resolveScopedProfileIds(scopeRoles)
  ├─ 정상(≤200명)  → .or( 관계 스코프 일치 | coach/coachee ∈ 스코프 프로필 ) → 범위 안 관계만 ✅
  ├─ 200명 초과    → null → .or() 없이 조회 → 전체 active 관계 ❌
  └─ DB 조회 오류  → null → .or() 없이 조회 → 전체 active 관계 ❌ (fail-open)
```

결과적으로 큰 조직·국가의 관리자, 또는 일시적 DB 오류가 난 요청에서
관계 표(`relationshipRows`, `printRelationshipRows`)에 **다른 조직·국가의 코치/코치이 이름·이메일·성취율**이 노출될 수 있다.

참고: `coach-stats.ts`는 같은 상황을 `relationshipMatchesScope` 메모리 필터로 막고 있다.

---

## 수정 방향

**넓은 범위이면서 super_admin이 아닌 경우, 프로필을 불러온 뒤 관계를 항상 메모리에서 한 번 더 거른다.**

- 메모리 규칙은 현재 DB `.or()` 사전 필터와 **완전히 같은 의미**로 만든다. 그러면 정상 경우(≤200명) 결과는 동일하다.
- 폴백(200명 초과·오류) 경우에만 범위 밖 관계가 제거된다.
- DB 사전 필터는 그대로 둔다(성능용). 메모리 필터가 최종 판정이다.

### 현재 DB 필터의 정확한 의미 (메모리 규칙이 따라야 할 것)

대상 역할 = `scopeRoles` 중 `scope_id`가 있고 `scope_type`이 `global`·`coach`가 **아닌** 역할. 관계가 아래 중 하나를 만족하면 포함한다.

1. `relationship.scope_type === role.scope_type && relationship.scope_id === role.scope_id`
2. coach 또는 coachee 프로필(삭제되지 않은 것)의 해당 스코프 컬럼이 `role.scope_id`와 같다.
   - country → `country_id`, region → `region_id`, organization → `organization_id`, church → `church_id`, group → `group_id`, cohort → `cohort_id`
- 대상 역할이 하나도 없으면 → **관계 0건**(현재 `id.eq.0000…` 동작과 동일)

> ⚠️ `coach-stats.ts`의 `relationshipMatchesScope`를 **그대로 복사하지 말 것.** 그 함수는 `global` 역할이면 `true`, `coach` 스코프면 coach 일치로 판정한다. 이 파일의 현재 의미(둘 다 제외)와 다르다.
> 두 의미의 차이는 아래 "결정 필요" 2번에서 따로 다룬다.

---

## 수정 파일 (정확히 1개)

- **EDIT**: `src/lib/api/coach-maker/moksilgi-progress.ts`

## 건드리지 않을 것

- 역할 판정(`ALLOWED_ROLES`, `BROAD_ACCESS_ROLES`), roles 조회, `resolveScopedProfileIds` 본문
  - `hasFullRelationshipAccess`는 **Step 0에서만** 바꾼다. 다른 곳은 바꾸지 않는다.
- DB 사전 필터(`.or()` 조립), 상한 `MAX_DB_PREFILTER_PROFILE_IDS`(200), 페이징
- **plans 목록의 범위**(아래 "결정 필요" 1번), `scopeMode` 값
- `buildRelationshipProgressRows` 본문, 계산 함수, 반환 타입·필드
- `coach-stats.ts`, `src/lib/auth/**`, `src/proxy.ts`, `supabase/**`, 다른 모든 파일

---

## Step 0 — global 스코프 역할을 전체 관계 접근으로 취급 (사용자 결정 반영, 동작 변화)

broad 경로(`else` 블록)의 전체 접근 판정을 바꾼다.

```ts
// 현재
const hasFullRelationshipAccess = roleValues.includes("super_admin");

// 변경: coach-stats.ts와 같은 기준 — super_admin 또는 global 스코프 역할이면 전체 관계
const hasFullRelationshipAccess =
  roleValues.includes("super_admin") ||
  scopeRoles.some((role) => role.scope_type === "global");
```

- **의도된 동작 변화:** global 스코프의 organization_admin·country_admin은 지금 관계 0건을 보는데, 수정 후에는 전체 관계를 본다(2026-11-23 사용자 승인).
- `scopeRoles`는 이미 `ALLOWED_ROLES` 역할만 담는다(roles 조회 조건). 새 역할을 추가하지 않는다.
- 이 경로에 들어오는 조건(`hasBroadAccess`)은 바꾸지 않는다. coach_maker·church_admin은 global 스코프여도 지금처럼 직접 코칭 관계만 본다.
  - 이 부분도 바꿀지는 이번 범위가 아니다. 관찰만 보고한다.

## Step 1 — 필요한 컬럼 추가

1. `RelationshipRow` 타입에 `scope_type: ScopeType | null;`, `scope_id: string | null;`을 추가한다.
2. 관계 조회 select 2곳(직접 코칭 경로, broad 경로) 모두 `"id, coach_profile_id, coachee_profile_id, status, scope_type, scope_id"`로 바꾼다.
3. `ProfileRow`의 Pick에 `"cohort_id"`를 추가하고, profiles 묶음 조회 select 문자열에도 `cohort_id`를 추가한다.

> 컬럼 추가는 반환 데이터에 영향을 주지 않는다. `buildRelationshipProgressRows`는 필요한 필드만 골라 쓴다.

## Step 2 — 메모리 필터용 범위 역할 보관

broad 경로(`else` 블록) 밖에서 쓸 수 있도록 변수를 끌어올린다.

```ts
// broad 경로에서 super_admin이 아닐 때만 설정. 관계 표를 메모리에서 최종 판정할 때 쓴다.
let relationshipScopeRoles: ScopedRoleRow[] | null = null;
```

`else` 블록 안에서 `!hasFullRelationshipAccess`이면 다음을 설정한다.

```ts
relationshipScopeRoles = scopeRoles.filter(
  (role) => role.scope_id && role.scope_type !== "global" && role.scope_type !== "coach",
);
```

## Step 3 — 헬퍼 추가 (파일 상단 헬퍼 근처)

```ts
function getProfileScopeValue(profile: ProfileRow | undefined, scopeType: ScopeType) {
  switch (scopeType) {
    case "country":
      return profile?.country_id ?? null;
    case "region":
      return profile?.region_id ?? null;
    case "organization":
      return profile?.organization_id ?? null;
    case "church":
      return profile?.church_id ?? null;
    case "group":
      return profile?.group_id ?? null;
    case "cohort":
      return profile?.cohort_id ?? null;
    default:
      return null;
  }
}

/**
 * broad(비 super_admin) 경로의 DB 사전 필터와 같은 의미로 관계를 최종 판정한다.
 * 사전 필터가 꺼지는 경우(스코프 200명 초과, 조회 오류)에도 범위 밖 관계가 섞이지 않게 한다.
 * scopeRoles는 scope_id가 있고 global/coach가 아닌 역할만 담겨 있어야 한다.
 */
function relationshipInPrefilterScope(
  relationship: RelationshipRow,
  profilesById: Map<string, ProfileRow>,
  scopeRoles: ScopedRoleRow[],
) {
  const coach = profilesById.get(relationship.coach_profile_id);
  const coachee = profilesById.get(relationship.coachee_profile_id);

  return scopeRoles.some(
    (role) =>
      (relationship.scope_type === role.scope_type &&
        relationship.scope_id === role.scope_id) ||
      getProfileScopeValue(coach, role.scope_type) === role.scope_id ||
      getProfileScopeValue(coachee, role.scope_type) === role.scope_id,
  );
}
```

- 이 파일에 이미 같은 이름의 함수가 있으면 이름을 바꿔 충돌을 피한다.
- `any` 금지, `@ts-ignore` 금지.

## Step 4 — 프로필 로드 직후 관계 최종 필터

`const profileById = mapById(profileRows);` **바로 다음**, 그리고 `rowsByProfileId` / `buildRelationshipProgressRows` 호출 **이전**에 추가한다.

```ts
if (relationshipScopeRoles) {
  const scopeRolesForFilter = relationshipScopeRoles;
  const beforeCount = activeRelationships.length;
  activeRelationships = activeRelationships.filter((relationship) =>
    relationshipInPrefilterScope(relationship, profileById, scopeRolesForFilter),
  );
  perf.mark("data.relationships_scope_filter", beforeCount - activeRelationships.length);
}
```

- `profileIds`(프로필 조회 대상)는 필터 **전** 관계로 만들어지므로 필요한 프로필은 모두 로드되어 있다. 이 순서를 바꾸지 말 것.
- `perf.mark` 값은 "제거된 관계 수"다. 정상 경우에는 항상 0이어야 한다. 0이 아니면 폴백이 발생했다는 뜻이다.

---

## 검증

1. `npm run typecheck` / `npm run check:all` / `npm run build` 모두 통과
2. **정상 경우 결과 동일** (현재 데이터):
   - organization_admin·country_admin 계정으로 `/coach-maker/moksilgi-progress`의 관계 표 행 수와 내용, 인쇄 관계 표가 수정 전과 같다.
   - Vercel 로그 `data.relationships_scope_filter` 값이 0이다.
3. **폴백 경우 차단** (로컬에서만, 확인 후 반드시 되돌림):
   - `MAX_DB_PREFILTER_PROFILE_IDS`를 임시로 `1`로 바꾸고 organization_admin으로 접속한다.
   - 관계 표가 2번과 **같은 행**만 보여야 한다. 전체 관계가 나오면 실패다.
   - 확인 후 `200`으로 되돌린다. 이 임시 변경은 커밋하지 않는다.
4. super_admin(전체 관계), coach_maker(직접 관계)는 수정 전과 동일
5. **Step 0 확인:** global 스코프 organization_admin 또는 country_admin 계정이 관계 표에서 **전체 active 관계**를 본다. super_admin과 같은 행 수여야 한다.
   - 그런 계정이 없으면 SQL로 대상이 있는지만 확인하고 보고한다.
   ```sql
   select p.email, ur.role, ur.scope_type
   from user_roles ur join profiles p on p.id = ur.profile_id
   where ur.role in ('organization_admin','country_admin') and ur.scope_type = 'global'
     and ur.status = 'active' and ur.is_active and ur.deleted_at is null;
   ```

## 보고 형식

- 변경 내용(Step 0~4, 라인)
- 검증 2·3번 결과
- typecheck / check:all / build 결과
- 아래 "결정 필요" 항목에 대한 관찰(코드는 바꾸지 않음)

---

## 결정 필요 (이번 범위에서 수정 금지 — 사용자 판단 후 별도 작업)

1. ✅ **결정 완료 (2026-11-23, 사용자 확인): 의도된 정책.**
   organization_admin·country_admin이 목실기 목록·개요·인쇄 행을 **전체 사용자 기준**(`scopeMode: "all"`)으로 보는 것은 의도된 동작이다. **plans 범위는 바꾸지 않는다.**
   이번 수정은 관계 표(`relationshipRows`, `printRelationshipRows`)의 범위 폴백만 다룬다.
2. ✅ **결정 완료 (2026-11-23, 사용자 확인): global 스코프는 전체 관계를 본다.** → 아래 **Step 0**으로 이번 작업에 포함한다.
   - `coach-stats.ts`와 같은 기준이다(`fullAccess = super_admin || scope_type === "global"`).
   - `coach` 스코프 역할은 이번 결정 범위가 아니다. 현재처럼 broad 경로 필터에서 제외한다.
