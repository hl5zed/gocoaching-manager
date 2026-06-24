# Cursor 작업 명령어 — 성능: coach-stats 전체 관계 테이블 스캔 제거 (DB 스코프 사전 필터)

> ⚠️ **coach-maker 데이터 흐름.** 사용자가 명시적으로 승인한 단일 성능 개선.
> 한 번에 이 한 가지만. **권한/스코프 판정 결과는 바꾸지 않는다** — DB에서 가져오는 행 수만 줄인다.

---

## 배경 (병목)

`src/lib/api/coach-maker/coach-stats.ts`의 `getCoachMakerCoachStats`는
스코프 필터 없이 **active 관계 테이블 전체**와 **그 모든 프로필**을 가져온 뒤 메모리에서 거른다.

```
L474  coaching_relationships  WHERE status='active'        ← 스코프 .eq 없음, 전체 fetch
L518  profiles  IN (위 전체 관계의 모든 coach/coachee id)   ← 전체 프로필 fetch
L538  메모리에서 relationshipMatchesScope() 로 필터링
```

지역 단위 coach_maker가 대시보드를 열 때마다 전 조직 데이터를 끌어온다. 같은 종류의 문제를 `coaching-genealogy`와 `moksilgi-progress`는 이미 **DB 단 사전 필터**로 해결했는데, 이 함수만 빠져 있다.

## 정확성 핵심 (반드시 지킬 것)

`relationshipMatchesScope`는 두 가지로 매칭한다:
1. 관계 자체의 `scope_type/scope_id` 일치, 또는 `scope_type==="coach"`면 `coach_profile_id` 일치
2. **coach/coachee 프로필의 스코프 값**(region_id 등) 일치 — 이건 관계 행만으로 DB 필터가 안 됨

따라서 genealogy의 필터를 그대로 옮기면 (2)번 케이스가 누락돼 **결과가 달라질 수 있다.**
이를 막기 위해:

> **DB 사전 필터는 항상 "초집합(superset)"으로 만들고, 기존 메모리 필터(`relationshipMatchesScope`)는 그대로 둔다.**
> 그러면 DB가 좀 더 많이 가져오더라도 최종 결과는 현재와 **완전히 동일**하다. 위험은 "과소 포함"뿐이므로 그것만 피하면 된다.

초집합을 보장하려면 (2)번을 위해 **스코프에 속한 프로필 id를 먼저 DB에서 해석**한 뒤, 관계 쿼리에 `coach_profile_id.in(...) OR coachee_profile_id.in(...)`를 추가한다 (moksilgi-progress의 `accessibleProfileIds` 패턴과 동일).

폴백: 스코프 프로필 수가 임계치를 넘으면 사전 필터를 포기하고 **기존 전체 fetch로 폴백**한다 → 정확성 절대 훼손 없음.

---

## 수정 파일 (정확히 1개)

- **EDIT**: `src/lib/api/coach-maker/coach-stats.ts`

## 건드리지 않을 것

- `relationshipMatchesScope`, `getProfileScopeValue`, `hasCoachMakerFullAccess` 본문 (그대로 — 최종 필터로 계속 사용)
- L495 이후의 메모리 집계 로직 전부 (`scopedRelationships` 필터, Promise.all 등)
- 같은 파일의 `getCoachMakerMoksilgiDashboardSummary`(L889~) — 이번 범위 밖 (동일 패턴 후속 적용 가능, 별도 작업)
- `supabase/**`, RLS, `package.json`, 다른 모든 파일

---

## Step 1 — 헬퍼 추가

파일 상단 헬퍼들 근처(예: `hasCoachMakerFullAccess` 아래)에 추가한다. 상수 값은 기존 `moksilgi-progress.ts`와 동일하게 **200**으로 맞춘다.

```ts
const MAX_SCOPE_PREFILTER_PROFILE_IDS = 200;

/**
 * 역할 스코프(country/region/org/church/group/cohort)에 속한 프로필 id를 DB에서 미리 해석한다.
 * 관계를 coach/coachee 프로필 스코프로도 매칭하므로 초집합 보장을 위해 필요하다.
 * - 임계치를 넘거나 에러면 null 반환 → 호출부가 기존(전체 fetch) 동작으로 폴백.
 * - 해석할 스코프가 없으면 빈 배열 반환.
 */
async function resolveScopedProfileIds(
  serviceClient: ServiceSupabaseClient,
  roles: CoachMakerRoleRow[],
): Promise<string[] | null> {
  const orFilters = roles
    .filter((r) => r.scope_id && r.scope_type !== "global" && r.scope_type !== "coach")
    .map((r) => {
      switch (r.scope_type) {
        case "country": return `country_id.eq.${r.scope_id}`;
        case "region": return `region_id.eq.${r.scope_id}`;
        case "organization": return `organization_id.eq.${r.scope_id}`;
        case "church": return `church_id.eq.${r.scope_id}`;
        case "group": return `group_id.eq.${r.scope_id}`;
        case "cohort": return `cohort_id.eq.${r.scope_id}`;
        default: return null;
      }
    })
    .filter((v): v is string => v !== null);

  if (orFilters.length === 0) return [];

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id")
    .or(orFilters.join(","))
    .is("deleted_at", null)
    .limit(MAX_SCOPE_PREFILTER_PROFILE_IDS + 1);

  if (error) return null; // 폴백
  const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (ids.length > MAX_SCOPE_PREFILTER_PROFILE_IDS) return null; // 폴백
  return ids;
}
```

## Step 2 — 관계 fetch에 사전 필터 적용 (L474 부근)

현재 코드:

```ts
  const { data: relationships, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select(
      "id, coach_profile_id, coachee_profile_id, relationship_type, status, scope_type, scope_id, started_at, created_at",
    )
    .eq("status", "active")
    .is("deleted_at", null);
```

아래로 교체한다 (select 컬럼 문자열은 **그대로 유지**):

```ts
  const fullAccess =
    hasCoachMakerFullAccess(coachMakerRoles) ||
    coachMakerRoles.some((role) => role.scope_type === "global");

  let relationshipQuery = serviceClient
    .from("coaching_relationships")
    .select(
      "id, coach_profile_id, coachee_profile_id, relationship_type, status, scope_type, scope_id, started_at, created_at",
    )
    .eq("status", "active")
    .is("deleted_at", null);

  if (!fullAccess) {
    const scopedProfileIds = await resolveScopedProfileIds(serviceClient, coachMakerRoles);

    // scopedProfileIds === null → 폴백: 사전 필터 없이 기존처럼 전체 fetch (정확성 우선)
    if (scopedProfileIds !== null) {
      const orParts: string[] = [];

      // (1) 관계 자체 스코프 매칭
      for (const role of coachMakerRoles) {
        if (role.scope_id && role.scope_type !== "global" && role.scope_type !== "coach") {
          orParts.push(`and(scope_type.eq.${role.scope_type},scope_id.eq.${role.scope_id})`);
        }
      }
      // (2) coach 스코프 역할
      for (const role of coachMakerRoles) {
        if (role.scope_type === "coach" && role.scope_id) {
          orParts.push(`coach_profile_id.eq.${role.scope_id}`);
        }
      }
      // (3) coach/coachee 프로필 스코프 매칭 (초집합 보장)
      if (scopedProfileIds.length > 0) {
        const list = `(${scopedProfileIds.join(",")})`;
        orParts.push(`coach_profile_id.in.${list}`);
        orParts.push(`coachee_profile_id.in.${list}`);
      }

      // 매칭 조건이 하나라도 있으면 사전 필터 적용. 없으면 결과 없음(빈 OR).
      relationshipQuery = relationshipQuery.or(
        orParts.length > 0
          ? orParts.join(",")
          : "id.eq.00000000-0000-0000-0000-000000000000",
      );
    }
  }

  const { data: relationships, error: relationshipsError } = await relationshipQuery;
```

## Step 3 — 이후 로직은 그대로

L495 이후(`allRelationships`, `profileIds`, `profiles.in("id", profileIds)`, `scopedRelationships = ... relationshipMatchesScope ...`, Promise.all 집계)는 **한 줄도 바꾸지 않는다.** 사전 필터가 초집합이므로 메모리 필터가 최종 정답을 보장한다.

---

## 정확성/동작 점검 포인트

- super_admin · global 스코프 → `fullAccess=true` → 사전 필터 미적용(기존과 동일하게 전체).
- 스코프 프로필 200개 초과 또는 profiles 조회 에러 → `null` 폴백 → 기존 전체 fetch(결과 동일, 단지 최적화 미적용).
- 그 외 → 더 적은 행을 가져오지만 `relationshipMatchesScope` 재검증으로 결과 불변.
- staging에서 **사전 필터 적용 케이스와 폴백 케이스의 대시보드 수치가 동일**한지 1회 비교 검증할 것.

## Step 4 — 검증 (필수)

```bash
npm run typecheck
npm run check:all
npm run build
```

---

## 반환 (보고할 것)

- 변경 파일 (정확히 1개)
- 추가한 `resolveScopedProfileIds` 위치, 상수 값(200)
- typecheck / check:all / build 통과 여부
- staging 수치 동일성 비교 결과(가능 시)

## 한 줄 요약

> coach-stats가 전체 관계 테이블 대신 스코프 초집합만 DB에서 가져오도록 사전 필터 추가. 메모리 필터는 그대로 둬서 결과는 불변, 임계치 초과 시 기존 동작으로 안전 폴백.
