import { getSession } from "@/lib/auth/getSession";
import { ensureCoachLevelAccess } from "@/lib/auth/coach-api-access";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  CoachFeedbackStatus,
  InsertDto,
  UpdateDto,
  WeeklyLogRow,
} from "@/types/database";

const SAVEABLE_FEEDBACK_STATUSES = new Set<CoachFeedbackStatus>([
  "draft",
  "published",
]);

const FEEDBACK_TEXT_MAX_LENGTH = 3000;
const OPTIONAL_TEXT_MAX_LENGTH = 2000;

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

type ProfileIdRow = {
  id: string;
};

type RelationshipRow = {
  id: string;
  coachee_profile_id: string;
};

type CoacheeProfileRow = {
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};

type ExistingFeedbackRow = {
  id: string;
  feedback_text: string;
  encouragement: string | null;
  next_step: string | null;
  status: CoachFeedbackStatus;
  version: number;
  created_at: string;
  updated_at: string;
};

type CoachFeedbackIdRow = {
  id: string;
};

type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

type CoachFeedbackSelectChain = {
  eq: (
    column: "weekly_log_id" | "coach_profile_id",
    value: string,
  ) => CoachFeedbackSelectChain;
  is: (
    column: "deleted_at",
    value: null,
  ) => {
    maybeSingle: () => Promise<{
      data: ExistingFeedbackRow | null;
      error: PostgrestErrorLike | null;
    }>;
  };
};

type CoachFeedbackUpdateChain = {
  eq: (
    column: "id" | "coach_profile_id",
    value: string,
  ) => CoachFeedbackUpdateChain;
  is: (
    column: "deleted_at",
    value: null,
  ) => {
    select: (columns: string) => {
      maybeSingle: () => Promise<{
        data: CoachFeedbackIdRow | null;
        error: PostgrestErrorLike | null;
      }>;
    };
  };
};

type CoachFeedbackTable = {
  select: (columns: string) => CoachFeedbackSelectChain;
  update: (values: UpdateDto<"coach_feedback">) => CoachFeedbackUpdateChain;
  insert: (values: InsertDto<"coach_feedback">) => {
    select: (columns: string) => {
      maybeSingle: () => Promise<{
        data: CoachFeedbackIdRow | null;
        error: PostgrestErrorLike | null;
      }>;
    };
  };
};

type SafeWeeklyLogRow = Pick<
  WeeklyLogRow,
  | "id"
  | "relationship_id"
  | "coachee_profile_id"
  | "week_start"
  | "week_end"
  | "gratitude"
  | "prayer_request"
  | "progress_summary"
  | "difficulty"
  | "message_to_coach"
  | "status"
  | "submitted_at"
  | "updated_at"
>;

export type CoachWeeklyLogFeedbackForm = {
  weeklyLog: SafeWeeklyLogRow;
  coachee: CoacheeProfileRow | null;
  feedback: ExistingFeedbackRow | null;
};

export type CoachWeeklyLogFeedbackErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ROLES_QUERY_FAILED"
  | "ACCESS_DENIED"
  | "RELATIONSHIPS_QUERY_FAILED"
  | "LOG_QUERY_FAILED"
  | "COACHEE_PROFILE_QUERY_FAILED"
  | "FEEDBACK_QUERY_FAILED"
  | "VALIDATION_FAILED"
  | "SAVE_FAILED"
  | "NOT_FOUND";

export type CoachWeeklyLogFeedbackError = {
  code: CoachWeeklyLogFeedbackErrorCode;
  message: string;
};

export type GetCoachWeeklyLogFeedbackFormResult =
  | { data: CoachWeeklyLogFeedbackForm; error: null }
  | { data: null; error: CoachWeeklyLogFeedbackError };

export type SaveCoachWeeklyLogFeedbackInput = {
  logId: string;
  feedback_text: string;
  encouragement: string;
  next_step: string;
  status: "draft" | "published";
};

export type SaveCoachWeeklyLogFeedbackResult =
  | { ok: true; feedbackId: string }
  | { ok: false; error: CoachWeeklyLogFeedbackError };

type OwnershipContext =
  | {
      ok: true;
      profileId: string;
      relationship: RelationshipRow;
      weeklyLog: SafeWeeklyLogRow;
      serviceClient: ServiceSupabaseClient;
    }
  | { ok: false; error: CoachWeeklyLogFeedbackError };

function createCoachFeedbackTable(
  supabase: ServerSupabaseClient | ServiceSupabaseClient,
): CoachFeedbackTable {
  return supabase.from("coach_feedback") as unknown as CoachFeedbackTable;
}

function normalizeOptionalText(value: string, maxLength: number) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true as const, value: null };
  }

  if (trimmed.length > maxLength) {
    return {
      ok: false as const,
      error: {
        code: "VALIDATION_FAILED" as const,
        message: "입력한 내용이 너무 깁니다.",
      },
    };
  }

  return { ok: true as const, value: trimmed };
}

function getServiceClientResult():
  | { ok: true; serviceClient: ServiceSupabaseClient }
  | { ok: false; error: CoachWeeklyLogFeedbackError } {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    console.error("[COACH_FEEDBACK_SERVICE_CLIENT_UNAVAILABLE]", error);
    return {
      ok: false,
      error: {
        code: "LOG_QUERY_FAILED",
        message: "주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  return { ok: true, serviceClient: client };
}

async function getOwnedWeeklyLogContext(
  logId: string,
): Promise<OwnershipContext> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase.from("profiles").select("id");

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError) {
    return {
      ok: false,
      error: {
        code: "PROFILE_QUERY_FAILED",
        message: "프로필을 불러올 수 없습니다.",
      },
    };
  }

  if (!profile) {
    return {
      ok: false,
      error: {
        code: "PROFILE_NOT_FOUND",
        message: "아직 프로필이 생성되지 않았습니다.",
      },
    };
  }

  const profileId = (profile as ProfileIdRow).id;
  const coachAccess = await ensureCoachLevelAccess(supabase, profileId);

  if (!coachAccess.ok) {
    return {
      ok: false,
      error: { code: coachAccess.code, message: coachAccess.message },
    };
  }

  const serviceClientResult = getServiceClientResult();

  if (!serviceClientResult.ok) {
    return { ok: false, error: serviceClientResult.error };
  }

  const { serviceClient } = serviceClientResult;
  const { data: weeklyLog, error: weeklyLogError } = await serviceClient
    .from("weekly_logs")
    .select(
      "id, relationship_id, coachee_profile_id, week_start, week_end, gratitude, prayer_request, progress_summary, difficulty, message_to_coach, status, submitted_at, updated_at",
    )
    .eq("id", logId)
    .is("deleted_at", null)
    .maybeSingle();

  if (weeklyLogError) {
    return {
      ok: false,
      error: {
        code: "LOG_QUERY_FAILED",
        message: "주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  if (!weeklyLog) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "해당 주간 기록을 찾을 수 없습니다.",
      },
    };
  }

  const weeklyLogRow = weeklyLog as SafeWeeklyLogRow;
  const { data: relationship, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select("id, coachee_profile_id")
    .eq("id", weeklyLogRow.relationship_id)
    .eq("coach_profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (relationshipsError) {
    return {
      ok: false,
      error: {
        code: "RELATIONSHIPS_QUERY_FAILED",
        message: "코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  if (!relationship) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "해당 주간 기록을 찾을 수 없습니다.",
      },
    };
  }

  return {
    ok: true,
    profileId,
    relationship: relationship as RelationshipRow,
    weeklyLog: weeklyLogRow,
    serviceClient,
  };
}

export async function getCoachWeeklyLogFeedbackForm(
  logId: string,
): Promise<GetCoachWeeklyLogFeedbackFormResult> {
  const context = await getOwnedWeeklyLogContext(logId);

  if (!context.ok) {
    return { data: null, error: context.error };
  }

  const { data: coacheeProfile, error: coacheeProfileError } =
    await context.serviceClient
      .from("profiles")
      .select("display_name, full_name, email")
      .eq("id", context.weeklyLog.coachee_profile_id)
      .is("deleted_at", null)
      .maybeSingle();

  if (coacheeProfileError) {
    return {
      data: null,
      error: {
        code: "COACHEE_PROFILE_QUERY_FAILED",
        message: "코치이 정보를 불러올 수 없습니다.",
      },
    };
  }

  const feedbackTable = createCoachFeedbackTable(context.serviceClient);
  const { data: feedback, error: feedbackError } = await feedbackTable
    .select(
      "id, feedback_text, encouragement, next_step, status, version, created_at, updated_at",
    )
    .eq("weekly_log_id", context.weeklyLog.id)
    .eq("coach_profile_id", context.profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (feedbackError) {
    return {
      data: null,
      error: {
        code: "FEEDBACK_QUERY_FAILED",
        message: "피드백을 불러올 수 없습니다.",
      },
    };
  }

  return {
    data: {
      weeklyLog: context.weeklyLog,
      coachee: (coacheeProfile ?? null) as CoacheeProfileRow | null,
      feedback: (feedback ?? null) as ExistingFeedbackRow | null,
    },
    error: null,
  };
}

export async function saveCoachWeeklyLogFeedback(
  input: SaveCoachWeeklyLogFeedbackInput,
): Promise<SaveCoachWeeklyLogFeedbackResult> {
  if (!SAVEABLE_FEEDBACK_STATUSES.has(input.status)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "피드백 상태가 올바르지 않습니다.",
      },
    };
  }

  const feedbackText = input.feedback_text.trim();

  if (feedbackText.length > FEEDBACK_TEXT_MAX_LENGTH) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "피드백 내용이 너무 깁니다.",
      },
    };
  }

  if (input.status === "published" && feedbackText.length === 0) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "게시할 피드백 내용을 입력해 주세요.",
      },
    };
  }

  const encouragement = normalizeOptionalText(
    input.encouragement,
    OPTIONAL_TEXT_MAX_LENGTH,
  );

  if (!encouragement.ok) {
    return { ok: false, error: encouragement.error };
  }

  const nextStep = normalizeOptionalText(input.next_step, OPTIONAL_TEXT_MAX_LENGTH);

  if (!nextStep.ok) {
    return { ok: false, error: nextStep.error };
  }

  const context = await getOwnedWeeklyLogContext(input.logId);

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const feedbackTable = createCoachFeedbackTable(context.serviceClient);
  const { data: existingFeedback, error: existingFeedbackError } = await feedbackTable
    .select("id, version")
    .eq("weekly_log_id", context.weeklyLog.id)
    .eq("coach_profile_id", context.profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingFeedbackError) {
    return {
      ok: false,
      error: {
        code: "FEEDBACK_QUERY_FAILED",
        message: "피드백을 불러올 수 없습니다.",
      },
    };
  }

  const now = new Date().toISOString();

  if (existingFeedback) {
    const currentFeedback = existingFeedback as ExistingFeedbackRow;
    const updatePayload = {
      feedback_text: feedbackText,
      encouragement: encouragement.value,
      next_step: nextStep.value,
      status: input.status,
      version: currentFeedback.version + 1,
      updated_at: now,
    } satisfies UpdateDto<"coach_feedback">;

    const { data: updatedFeedback, error: updateError } = await feedbackTable
      .update(updatePayload)
      .eq("id", currentFeedback.id)
      .eq("coach_profile_id", context.profileId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedFeedback) {
      return {
        ok: false,
        error: {
          code: "SAVE_FAILED",
          message: "피드백을 저장할 수 없습니다.",
        },
      };
    }

    return { ok: true, feedbackId: updatedFeedback.id };
  }

  const insertPayload = {
    weekly_log_id: context.weeklyLog.id,
    relationship_id: context.weeklyLog.relationship_id,
    coach_profile_id: context.profileId,
    coachee_profile_id: context.weeklyLog.coachee_profile_id,
    feedback_text: feedbackText,
    encouragement: encouragement.value,
    next_step: nextStep.value,
    status: input.status,
    version: 1,
    created_at: now,
    updated_at: now,
  } satisfies InsertDto<"coach_feedback">;

  const { data: insertedFeedback, error: insertError } = await feedbackTable
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertError || !insertedFeedback) {
    return {
      ok: false,
      error: {
        code: "SAVE_FAILED",
        message: "피드백을 저장할 수 없습니다.",
      },
    };
  }

  return { ok: true, feedbackId: insertedFeedback.id };
}
