import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { InsertDto, Json, MoksilgiVersionType, Tables } from "@/types/database";

// ------------------------------------------------------------------
// 타입
// ------------------------------------------------------------------

export type MoksilgiPlanVersionRow = Tables<"moksilgi_plan_versions">;

export type CreateVersionInput = {
  plan_id: string;
  version_number: number;
  version_type: MoksilgiVersionType;
  /** plan의 현재 필드 + goal_areas + detail_goals를 JSON 스냅샷으로 전달 */
  snapshot_json: Record<string, unknown>;
  change_reason?: string;
  created_by: string;
};

const VERSION_SELECT =
  "id, plan_id, version_number, version_type, snapshot_json, change_reason, created_by, is_approved, approved_at, approved_by, created_at";

type PostgrestErrorLike = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} | null;

type PlanVersionsInsertTable = {
  insert: (values: InsertDto<"moksilgi_plan_versions">) => {
    select: (columns: typeof VERSION_SELECT) => {
      single: () => Promise<{
        data: MoksilgiPlanVersionRow | null;
        error: PostgrestErrorLike;
      }>;
    };
  };
};

// ------------------------------------------------------------------
// 버전 목록 조회 (최신순)
// ------------------------------------------------------------------

export async function getMoksilgiVersions(planId: string): Promise<
  | { ok: true; data: MoksilgiPlanVersionRow[] }
  | { ok: false; error: string }
> {
  const { client, error: clientError } = createSupabaseServiceClient();
  if (!client) {
    console.error("[MOKSILGI_VERSIONS_CLIENT_UNAVAILABLE]", clientError);
    return { ok: false, error: "서비스 클라이언트를 초기화할 수 없습니다." };
  }

  const { data, error } = await client
    .from("moksilgi_plan_versions")
    .select(VERSION_SELECT)
    .eq("plan_id", planId)
    .order("version_number", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[MOKSILGI_VERSIONS_FETCH_ERROR]", { message: error.message, code: error.code, details: error.details, hint: error.hint });
    return { ok: false, error: "버전 이력을 불러올 수 없습니다." };
  }

  return { ok: true, data: data ?? [] };
}

// ------------------------------------------------------------------
// 최근 코치 승인 버전 조회
// ------------------------------------------------------------------

export async function getLastApprovedVersion(planId: string): Promise<
  | { ok: true; data: MoksilgiPlanVersionRow | null }
  | { ok: false; error: string }
> {
  const { client, error: clientError } = createSupabaseServiceClient();
  if (!client) {
    console.error("[MOKSILGI_APPROVED_VERSION_CLIENT_UNAVAILABLE]", clientError);
    return { ok: false, error: "서비스 클라이언트를 초기화할 수 없습니다." };
  }

  const { data, error } = await client
    .from("moksilgi_plan_versions")
    .select(VERSION_SELECT)
    .eq("plan_id", planId)
    .eq("is_approved", true)
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[MOKSILGI_APPROVED_VERSION_FETCH_ERROR]", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, error: "코치 승인 버전을 불러올 수 없습니다." };
  }

  return { ok: true, data: data ?? null };
}

// ------------------------------------------------------------------
// 새 버전 스냅샷 저장
// ------------------------------------------------------------------

export async function createMoksilgiVersion(input: CreateVersionInput): Promise<
  | { ok: true; data: MoksilgiPlanVersionRow }
  | { ok: false; error: string }
> {
  const { client, error: clientError } = createSupabaseServiceClient();
  if (!client) {
    console.error("[MOKSILGI_CREATE_VERSION_CLIENT_UNAVAILABLE]", clientError);
    return { ok: false, error: "서비스 클라이언트를 초기화할 수 없습니다." };
  }

  const insertPayload: InsertDto<"moksilgi_plan_versions"> = {
    plan_id: input.plan_id,
    version_number: input.version_number,
    version_type: input.version_type,
    snapshot_json: input.snapshot_json as Json,
    change_reason: input.change_reason ?? null,
    created_by: input.created_by,
    is_approved: input.version_type === "approved",
    approved_at: input.version_type === "approved" ? new Date().toISOString() : null,
  };

  const { data, error } = await (client.from(
    "moksilgi_plan_versions",
  ) as unknown as PlanVersionsInsertTable)
    .insert(insertPayload)
    .select(VERSION_SELECT)
    .single();

  if (error) {
    console.error("[MOKSILGI_CREATE_VERSION_ERROR]", { message: error.message, code: error.code, details: error.details, hint: error.hint });
    return { ok: false, error: "버전을 저장할 수 없습니다." };
  }

  if (!data) {
    return { ok: false, error: "저장된 버전을 확인할 수 없습니다." };
  }

  return { ok: true, data };
}
