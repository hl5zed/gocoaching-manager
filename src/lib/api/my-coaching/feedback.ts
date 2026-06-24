import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { CoachFeedbackStatus, WeeklyLogStatus } from "@/types/database";

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

type ProfileIdRow = {
  id: string;
};

type CoachFeedbackRow = {
  id: string;
  weekly_log_id: string;
  relationship_id: string;
  coach_profile_id: string;
  coachee_profile_id: string;
  feedback_text: string;
  encouragement: string | null;
  next_step: string | null;
  status: CoachFeedbackStatus;
  version: number;
  created_at: string;
  updated_at: string;
};

type WeeklyLogSummaryRow = {
  id: string;
  coachee_profile_id: string;
  week_start: string;
  week_end: string;
  status: WeeklyLogStatus;
  submitted_at: string | null;
  updated_at: string;
};

type CoachProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};

export type MyCoachingFeedbackItem = {
  id: string;
  weekly_log_id: string;
  relationship_id: string;
  feedback_text: string;
  encouragement: string | null;
  next_step: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  week_start: string | null;
  week_end: string | null;
  weekly_log_status: string | null;
  weekly_log_submitted_at: string | null;
  coach_display_name: string | null;
  coach_full_name: string | null;
  coach_email: string | null;
};

export type GetMyCoachingFeedbackErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "FEEDBACK_QUERY_FAILED"
  | "WEEKLY_LOGS_QUERY_FAILED"
  | "COACH_PROFILES_QUERY_FAILED";

export type GetMyCoachingFeedbackResult =
  | { data: MyCoachingFeedbackItem[]; error: null }
  | {
      data: null;
      error: { code: GetMyCoachingFeedbackErrorCode; message: string };
    };

function getServiceClientResult():
  | { ok: true; serviceClient: ServiceSupabaseClient }
  | {
      ok: false;
      error: { code: "FEEDBACK_QUERY_FAILED"; message: string };
    } {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    console.error("[MY_COACHING_FEEDBACK_SERVICE_CLIENT_UNAVAILABLE]", error);
    return {
      ok: false,
      error: {
        code: "FEEDBACK_QUERY_FAILED",
        message: "지금 피드백을 불러올 수 없습니다.",
      },
    };
  }

  return { ok: true, serviceClient: client };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function normalizeOptionalText(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function getMyCoachingFeedback(options?: {
  knownProfileId?: string;
}): Promise<GetMyCoachingFeedbackResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    };
  }

  let profileId = options?.knownProfileId ?? (await getVerifiedProfileId());

  if (!profileId) {
    const supabase = await createSupabaseServerClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .is("deleted_at", null)
      .neq("status", "anonymized")
      .maybeSingle();

    if (profileError) {
      return {
        data: null,
        error: {
          code: "PROFILE_QUERY_FAILED",
          message: "프로필을 불러올 수 없습니다.",
        },
      };
    }

    if (!profile) {
      return {
        data: null,
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "아직 프로필이 생성되지 않았습니다.",
        },
      };
    }

    profileId = (profile as ProfileIdRow).id;
  }

  const serviceClientResult = getServiceClientResult();

  if (!serviceClientResult.ok) {
    return { data: null, error: serviceClientResult.error };
  }

  const { serviceClient } = serviceClientResult;
  const { data: feedbackRows, error: feedbackError } = await serviceClient
    .from("coach_feedback")
    .select(
      "id, weekly_log_id, relationship_id, coach_profile_id, coachee_profile_id, feedback_text, encouragement, next_step, status, version, created_at, updated_at",
    )
    .eq("coachee_profile_id", profileId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (feedbackError) {
    return {
      data: null,
      error: {
        code: "FEEDBACK_QUERY_FAILED",
        message: "지금 피드백을 불러올 수 없습니다.",
      },
    };
  }

  const feedback = (feedbackRows ?? []) as CoachFeedbackRow[];

  if (feedback.length === 0) {
    return { data: [], error: null };
  }

  const weeklyLogIds = uniqueStrings(
    feedback.map((item) => item.weekly_log_id),
  );
  const { data: weeklyLogRows, error: weeklyLogsError } = await serviceClient
    .from("weekly_logs")
    .select("id, coachee_profile_id, week_start, week_end, status, submitted_at, updated_at")
    .in("id", weeklyLogIds)
    .eq("coachee_profile_id", profileId)
    .is("deleted_at", null);

  if (weeklyLogsError) {
    return {
      data: null,
      error: {
        code: "WEEKLY_LOGS_QUERY_FAILED",
        message: "주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  const weeklyLogById = new Map<string, WeeklyLogSummaryRow>();

  for (const weeklyLog of (weeklyLogRows ?? []) as WeeklyLogSummaryRow[]) {
    weeklyLogById.set(weeklyLog.id, weeklyLog);
  }

  const ownedFeedback = feedback.filter((item) => {
    const weeklyLog = weeklyLogById.get(item.weekly_log_id);

    return (
      weeklyLog !== undefined &&
      item.coachee_profile_id === profileId &&
      weeklyLog.coachee_profile_id === profileId
    );
  });

  if (ownedFeedback.length === 0) {
    return { data: [], error: null };
  }

  const coachProfileIds = uniqueStrings(
    ownedFeedback.map((item) => item.coach_profile_id),
  );
  const coachProfileById = new Map<string, CoachProfileRow>();

  if (coachProfileIds.length > 0) {
    const { data: coachProfiles, error: coachProfilesError } =
      await serviceClient
        .from("profiles")
        .select("id, display_name, full_name, email")
        .in("id", coachProfileIds)
        .is("deleted_at", null);

    if (coachProfilesError) {
      return {
        data: null,
        error: {
          code: "COACH_PROFILES_QUERY_FAILED",
          message: "코치 정보를 불러올 수 없습니다.",
        },
      };
    }

    for (const coachProfile of (coachProfiles ?? []) as CoachProfileRow[]) {
      coachProfileById.set(coachProfile.id, {
        id: coachProfile.id,
        display_name: normalizeOptionalText(coachProfile.display_name),
        full_name: normalizeOptionalText(coachProfile.full_name),
        email: normalizeOptionalText(coachProfile.email),
      });
    }
  }

  return {
    data: ownedFeedback.map((item) => {
      const weeklyLog = weeklyLogById.get(item.weekly_log_id);
      const coachProfile = coachProfileById.get(item.coach_profile_id);

      return {
        id: item.id,
        weekly_log_id: item.weekly_log_id,
        relationship_id: item.relationship_id,
        feedback_text: item.feedback_text,
        encouragement: item.encouragement,
        next_step: item.next_step,
        status: item.status,
        version: item.version,
        created_at: item.created_at,
        updated_at: item.updated_at,
        week_start: weeklyLog?.week_start ?? null,
        week_end: weeklyLog?.week_end ?? null,
        weekly_log_status: weeklyLog?.status ?? null,
        weekly_log_submitted_at: weeklyLog?.submitted_at ?? null,
        coach_display_name: coachProfile?.display_name ?? null,
        coach_full_name: coachProfile?.full_name ?? null,
        coach_email: coachProfile?.email ?? null,
      };
    }),
    error: null,
  };
}
