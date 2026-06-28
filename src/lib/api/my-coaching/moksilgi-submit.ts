import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createMoksilgiVersion } from "./moksilgi-versions";

export type SubmitMoksilgiResult =
  | { ok: true }
  | { ok: false; error: string };

type PlanRow = {
  id: string;
  version_number: number;
  version_type: string;
  status: string;
};

type UpdateValues = Record<string, string | number | null>;
type UpdateChain = {
  update: (values: UpdateValues) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        is: (col: string, val: null) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

type ProfileRow = { id: string };

export async function submitMoksilgiToCoach(
  planId: string,
): Promise<SubmitMoksilgiResult> {
  if (!planId) {
    return { ok: false, error: "목실기 정보가 없습니다." };
  }

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

  const { data: profileRaw, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError || !profileRaw) {
    return { ok: false, error: "프로필을 찾을 수 없습니다." };
  }

  const profileId = (profileRaw as unknown as ProfileRow).id;

  const { data: planRaw, error: planError } = await supabase
    .from("moksilgi_plans")
    .select("id, version_number, version_type, status")
    .eq("id", planId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (planError || !planRaw) {
    return { ok: false, error: "목실기 정보를 찾을 수 없습니다." };
  }

  const plan = planRaw as unknown as PlanRow;

  if (plan.version_type === "submitted") {
    return { ok: false, error: "이미 코치에게 제출된 상태입니다." };
  }

  if (plan.version_type === "approved") {
    return { ok: false, error: "이미 코치가 승인한 목실기입니다." };
  }

  const isResubmit = plan.version_type === "review_requested";
  const changeReason = isResubmit ? "보완 후 재제출" : "코치에게 제출";
  const nextVersionNumber = (plan.version_number ?? 1) + 1;
  const now = new Date().toISOString();

  const { error: updateError } = await (
    supabase.from("moksilgi_plans") as unknown as UpdateChain
  )
    .update({
      version_number: nextVersionNumber,
      version_type: "submitted",
      change_reason: changeReason,
      submitted_at: now,
      approved_at: null,
      approved_by_profile_id: null,
      updated_at: now,
    })
    .eq("id", planId)
    .eq("profile_id", profileId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("[MOKSILGI_SUBMIT_UPDATE_FAILED]", updateError);
    return { ok: false, error: "제출에 실패했습니다." };
  }

  // 제출 버전 스냅샷 생성 (실패해도 제출 자체는 성공 처리)
  const { client: serviceClient } = createSupabaseServiceClient();
  if (serviceClient) {
    const [areasResult, detailGoalsResult] = await Promise.all([
      serviceClient
        .from("moksilgi_goal_areas")
        .select("*")
        .eq("plan_id", planId)
        .is("deleted_at", null),
      serviceClient
        .from("moksilgi_detail_goals")
        .select("*")
        .eq("plan_id", planId)
        .is("deleted_at", null),
    ]);

    await createMoksilgiVersion({
      plan_id: planId,
      version_number: nextVersionNumber,
      version_type: "submitted",
      snapshot_json: {
        plan: {
          id: plan.id,
          version_number: nextVersionNumber,
          version_type: "submitted",
          submitted_at: now,
        },
        goal_areas: areasResult.data ?? [],
        detail_goals: detailGoalsResult.data ?? [],
      },
      change_reason: changeReason,
      created_by: profileId,
    });
  }

  return { ok: true };
}
