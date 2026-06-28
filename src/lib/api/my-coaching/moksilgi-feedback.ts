import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MoksilgiReviewStatus } from "@/types/database";

export type CoacheeReviewItem = {
  id: string;
  review_status: MoksilgiReviewStatus;
  feedback_content: string | null;
  created_at: string;
};

export type GetMyMoksilgiReviewsResult =
  | { ok: true; data: CoacheeReviewItem[] }
  | { ok: false; error: string };

type ProfileRow = { id: string };
type ReviewRow = {
  id: string;
  review_status: string;
  feedback_content: string | null;
  created_at: string;
};

export async function getMyMoksilgiCoachReviews(
  planId: string,
): Promise<GetMyMoksilgiReviewsResult> {
  if (!planId) {
    return { ok: false, error: "목실기 ID가 없습니다." };
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

  // 내 목실기인지 확인
  const { data: planRaw, error: planError } = await supabase
    .from("moksilgi_plans")
    .select("id")
    .eq("id", planId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (planError || !planRaw) {
    return { ok: false, error: "목실기를 찾을 수 없습니다." };
  }

  const { data: reviewsRaw, error: reviewsError } = await supabase
    .from("moksilgi_plan_reviews")
    .select("id, review_status, feedback_content, created_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (reviewsError) {
    console.error("[COACHEE_REVIEWS_FETCH_FAILED]", reviewsError);
    return { ok: false, error: "코치 피드백을 불러올 수 없습니다." };
  }

  return {
    ok: true,
    data: (reviewsRaw ?? []).map((r) => {
      const row = r as unknown as ReviewRow;
      return {
        id: row.id,
        review_status: row.review_status as MoksilgiReviewStatus,
        feedback_content: row.feedback_content,
        created_at: row.created_at,
      };
    }),
  };
}
