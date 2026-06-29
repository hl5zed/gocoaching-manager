import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ScopeType, UserRole } from "@/types/database";

/**
 * 관리자 범위(scope) 기반 회원 가시성 필터.
 *
 * profiles 테이블이 country/region/organization/church/group id를 모두
 * 비정규화 저장하므로, 상위 범위(예: 국가)가 하위(교회/그룹)를 포함하는
 * 계층 가시성을 별도 조인 없이 컬럼 매칭만으로 처리한다.
 *
 * 기존 app-layer scope 검사 패턴(create-invitation.ts)과 동일하게
 * DB/RLS는 변경하지 않고 애플리케이션 레이어에서만 필터를 적용한다.
 */

/** 관리 범위를 가질 수 있는 관리자 역할 (super_admin은 전체이므로 제외) */
const ADMIN_SCOPE_ROLES = new Set<UserRole>([
  "country_admin",
  "organization_admin",
  "church_admin",
]);

/** scope_type → profiles 컬럼 매핑 (전체 가시성에 사용하는 위계 컬럼만) */
const SCOPE_PROFILE_COLUMN: Partial<Record<ScopeType, string>> = {
  country: "country_id",
  region: "region_id",
  organization: "organization_id",
  church: "church_id",
  group: "group_id",
  cohort: "cohort_id",
};

type AdminScopeRow = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
};

export type AdminProfileScopeFilter =
  /** 전체 노출 (super_admin / 글로벌 범위) — 필터 미적용 */
  | { kind: "global" }
  /** 범위 한정 — profiles 쿼리에 적용할 PostgREST .or() 필터 문자열 */
  | { kind: "scoped"; orFilter: string }
  /** 관리 가능한 유효 범위 없음 — 결과를 비워야 함 */
  | { kind: "none" };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function loadAdminScopeRows(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<AdminScopeRow[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, scope_type, scope_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    return [];
  }

  return ((data ?? []) as AdminScopeRow[]).filter((row) =>
    ADMIN_SCOPE_ROLES.has(row.role),
  );
}

/**
 * 관리자의 활성 역할/범위를 읽어 회원 목록 가시성 필터를 만든다.
 *
 * - super_admin 또는 글로벌 범위 보유 → "global" (필터 없음)
 * - 매핑 가능한 범위 보유 → "scoped" (.or() 필터)
 * - 매핑 가능한 유효 범위 없음 → "none" (결과 비움)
 */
export async function resolveAdminProfileScope(
  supabase: SupabaseClient<Database>,
  profileId: string,
  roles: UserRole[],
): Promise<AdminProfileScopeFilter> {
  if (roles.includes("super_admin")) {
    return { kind: "global" };
  }

  const scopeRows = await loadAdminScopeRows(supabase, profileId);

  if (scopeRows.some((row) => row.scope_type === "global")) {
    return { kind: "global" };
  }

  const conditions = new Set<string>();

  for (const row of scopeRows) {
    const column = SCOPE_PROFILE_COLUMN[row.scope_type];

    if (!column || !row.scope_id || !isUuid(row.scope_id)) {
      continue;
    }

    conditions.add(`${column}.eq.${row.scope_id}`);
  }

  if (conditions.size === 0) {
    return { kind: "none" };
  }

  return { kind: "scoped", orFilter: Array.from(conditions).join(",") };
}

type ProfileIdRow = { id: string };

/**
 * 주어진 profile id들이 모두 관리자 범위 안에 있는지 검사한다.
 * 쓰기(생성) 경로에서 범위 밖 회원을 직접 지정하는 것을 막기 위한 강제 검증.
 *
 * - global → 항상 통과
 * - none → 항상 실패
 * - scoped → 범위 컬럼 매칭으로 모든 id가 포함되는지 확인
 */
export async function areProfileIdsWithinAdminScope(
  client: SupabaseClient<Database>,
  scope: AdminProfileScopeFilter,
  profileIds: string[],
): Promise<boolean> {
  if (scope.kind === "global") {
    return true;
  }

  if (scope.kind === "none") {
    return false;
  }

  const uniqueIds = Array.from(new Set(profileIds.filter((id) => id.length > 0)));

  if (uniqueIds.length === 0) {
    return true;
  }

  const { data, error } = await client
    .from("profiles")
    .select("id")
    .in("id", uniqueIds)
    .is("deleted_at", null)
    .or(scope.orFilter);

  if (error) {
    return false;
  }

  const inScope = new Set(((data ?? []) as ProfileIdRow[]).map((row) => row.id));

  return uniqueIds.every((id) => inScope.has(id));
}
