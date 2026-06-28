import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { MoksilgiReviewStatus, MoksilgiVersionType } from "@/types/database";

// ------------------------------------------------------------------
// 타입
// ------------------------------------------------------------------

export type CoachPlanReview = {
  id: string;
  version_id: string | null;
  review_status: MoksilgiReviewStatus;
  feedback_content: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachMoksilgiPlanStatusResult =
  | {
      ok: true;
      data: {
        plan_id: string;
        plan_version_type: MoksilgiVersionType;
        reviews: CoachPlanReview[];
      };
    }
  | { ok: false; error: string };

export type CreateCoachReviewInput = {
  plan_id: string;
  review_status: MoksilgiReviewStatus;
  feedback_content: string;
};

export type CreateCoachReviewResult =
  | { ok: true }
  | { ok: false; error: string };

export const REVIEW_STATUS_LABELS: Record<MoksilgiReviewStatus, string> = {
  reviewing: "검토 중",
  changes_requested: "보완 요청",
  confirmed: "확인 완료",
  approved: "승인",
};

export const PLAN_VERSION_TYPE_LABELS: Record<MoksilgiVersionType, string> = {
  draft: "작성 중",
  submitted: "코치 검토 대기",
  approved: "코치 승인 완료",
  self_updated: "자기 업데이트",
  review_requested: "코치 재검토 요청",
};

// ------------------------------------------------------------------
// 내부 타입 (Supabase 체이닝 우회)
// ------------------------------------------------------------------

type PlanStatusRow = {
  id: string;
  profile_id: string;
  version_type: string;
};

type ProfileIdRow = { id: string };
type RelationshipIdRow = { id: string };

type PlanReviewInsert = {
  plan_id: string;
  version_id: null;
  coach_profile_id: string;
  review_status: MoksilgiReviewStatus;
  feedback_content: string | null;
  created_at: string;
  updated_at: string;
};

type InsertTable<T> = {
  insert: (values: T) => Promise<{ error: { message: string; code?: string } | null }>;
};

type UpdateChain = {
  update: (values: Record<string, string | null>) => {
    eq: (col: string, val: string) => {
      is: (col: string, val: null) => Promise<{ error: { message: string; code?: string } | null }>;
    };
  };
};

type ServiceClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

// ------------------------------------------------------------------
// 프로필 ID 확인 (공통)
// ------------------------------------------------------------------

async function resolveCoachProfileId(): Promise<
  { ok: true; coachProfileId: string } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session.user) {
    return { ok: false, error: "로그인이 필요합니다." };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase
    .from("profiles")
    .select("id")
    .is("deleted_at", null)
    .neq("status", "anonymized");

  const { data: profileRaw, error } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (error || !profileRaw) {
    return { ok: false, error: "프로필을 찾을 수 없습니다." };
  }

  return {
    ok: true,
    coachProfileId: (profileRaw as unknown as ProfileIdRow).id,
  };
}

// ------------------------------------------------------------------
// 코칭 관계 검증 + plan 조회
// ------------------------------------------------------------------

async function verifyCoachAccessToPlan(
  serviceClient: ServiceClient,
  coachProfileId: string,
  planId: string,
): Promise<
  | { ok: true; plan: PlanStatusRow }
  | { ok: false; error: string }
> {
  const { data: planRaw, error: planError } = await serviceClient
    .from("moksilgi_plans")
    .select("id, profile_id, version_type")
    .eq("id", planId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (planError || !planRaw) {
    return { ok: false, error: "목실기를 찾을 수 없습니다." };
  }

  const plan = planRaw as unknown as PlanStatusRow;

  const { data: relationships, error: relError } = await serviceClient
    .from("coaching_relationships")
    .select("id")
    .eq("coach_profile_id", coachProfileId)
    .eq("coachee_profile_id", plan.profile_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(1);

  if (relError || !relationships || relationships.length === 0) {
    return {
      ok: false,
      error: "이 코치이의 목실기를 검토할 권한이 없습니다.",
    };
  }

  return { ok: true, plan };
}

// ------------------------------------------------------------------
// 코치: 목실기 상태 + 피드백 이력 조회
// ------------------------------------------------------------------

export async function getCoachMoksilgiPlanStatus(
  planId: string,
): Promise<CoachMoksilgiPlanStatusResult> {
  if (!planId) {
    return { ok: false, error: "목실기 ID가 없습니다." };
  }

  const profileResult = await resolveCoachProfileId();
  if (!profileResult.ok) {
    return { ok: false, error: profileResult.error };
  }

  const { client: serviceClient } = createSupabaseServiceClient();
  if (!serviceClient) {
    return { ok: false, error: "서비스 클라이언트를 초기화할 수 없습니다." };
  }

  const accessResult = await verifyCoachAccessToPlan(
    serviceClient,
    profileResult.coachProfileId,
    planId,
  );
  if (!accessResult.ok) {
    return { ok: false, error: accessResult.error };
  }

  const { data: reviewsRaw, error: reviewsError } = await serviceClient
    .from("moksilgi_plan_reviews")
    .select("id, version_id, review_status, feedback_content, created_at, updated_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (reviewsError) {
    console.error("[COACH_REVIEW_FETCH_FAILED]", reviewsError);
    return { ok: false, error: "피드백 이력을 불러올 수 없습니다." };
  }

  return {
    ok: true,
    data: {
      plan_id: accessResult.plan.id,
      plan_version_type: accessResult.plan.version_type as MoksilgiVersionType,
      reviews: (reviewsRaw ?? []) as CoachPlanReview[],
    },
  };
}

// ------------------------------------------------------------------
// 코치: 피드백 작성 + plan 상태 업데이트
// ------------------------------------------------------------------

function planVersionTypeFromReview(
  reviewStatus: MoksilgiReviewStatus,
  currentVersionType: MoksilgiVersionType,
): MoksilgiVersionType {
  if (reviewStatus === "changes_requested") return "review_requested";
  if (reviewStatus === "confirmed" || reviewStatus === "approved") return "approved";
  // "reviewing" 상태: 이미 approved인 플랜은 그대로 유지
  if (currentVersionType === "approved") return "approved";
  return "submitted";
}

export async function createCoachReview(
  input: CreateCoachReviewInput,
): Promise<CreateCoachReviewResult> {
  if (!input.plan_id || !input.review_status) {
    return { ok: false, error: "필수 정보가 없습니다." };
  }

  const profileResult = await resolveCoachProfileId();
  if (!profileResult.ok) {
    return { ok: false, error: profileResult.error };
  }

  const { client: serviceClient } = createSupabaseServiceClient();
  if (!serviceClient) {
    return { ok: false, error: "서비스 클라이언트를 초기화할 수 없습니다." };
  }

  const accessResult = await verifyCoachAccessToPlan(
    serviceClient,
    profileResult.coachProfileId,
    input.plan_id,
  );
  if (!accessResult.ok) {
    return { ok: false, error: accessResult.error };
  }

  const now = new Date().toISOString();
  const feedbackContent = input.feedback_content.trim() || null;

  // 피드백 저장
  const { error: insertError } = await (
    serviceClient.from("moksilgi_plan_reviews") as unknown as InsertTable<PlanReviewInsert>
  ).insert({
    plan_id: input.plan_id,
    version_id: null,
    coach_profile_id: profileResult.coachProfileId,
    review_status: input.review_status,
    feedback_content: feedbackContent,
    created_at: now,
    updated_at: now,
  });

  if (insertError) {
    console.error("[COACH_REVIEW_INSERT_FAILED]", insertError);
    return { ok: false, error: "피드백을 저장할 수 없습니다." };
  }

  // plan version_type 업데이트
  const newVersionType = planVersionTypeFromReview(
    input.review_status,
    accessResult.plan.version_type as MoksilgiVersionType,
  );
  const planUpdateValues: Record<string, string | null> = {
    version_type: newVersionType,
    updated_at: now,
  };
  if (newVersionType === "approved") {
    planUpdateValues.approved_at = now;
    planUpdateValues.approved_by_profile_id = profileResult.coachProfileId;
  }

  const { error: updateError } = await (
    serviceClient.from("moksilgi_plans") as unknown as UpdateChain
  )
    .update(planUpdateValues)
    .eq("id", input.plan_id)
    .is("deleted_at", null);

  if (updateError) {
    console.error("[COACH_REVIEW_PLAN_UPDATE_FAILED]", updateError);
    // 피드백은 저장됐으므로 ok 반환 (plan 상태 업데이트 실패는 무시)
  }

  return { ok: true };
}
