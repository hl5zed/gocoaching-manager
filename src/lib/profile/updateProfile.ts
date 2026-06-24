import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeTimezone } from "@/lib/timezone";
import type { SafeProfile, SelfUpdatePayload } from "@/types/profile";
import type { User } from "@/types/auth";

const allowedProfileFields = [
  "display_name",
  "preferred_language",
  "phone",
  "ministry_position",
  "timezone",
] as const;

type AllowedProfileField = (typeof allowedProfileFields)[number];

type AuditProfileValues = Pick<
  SafeProfile,
  | "display_name"
  | "preferred_language"
  | "phone"
  | "ministry_position"
  | "timezone"
>;

export type UpdateProfileErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_BODY"
  | "DISALLOWED_PROFILE_FIELDS"
  | "INVALID_PROFILE_FIELD_VALUE"
  | "INVALID_LANGUAGE"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "PROFILE_UPDATE_FAILED"
  | "AUDIT_LOG_FAILED";

export type UpdateProfileError = {
  code: UpdateProfileErrorCode;
  message: string;
  fields?: string[];
};

export type UpdateProfileResult =
  | {
      profile: SafeProfile;
      user: User;
      error: null;
    }
  | {
      profile: null;
      user: User | null;
      error: UpdateProfileError;
    };

const safeProfileSelectFields = [
  "id",
  "full_name",
  "display_name",
  "email",
  "phone",
  "primary_role",
  "growth_level_id",
  "generation_number",
  "status",
  "preferred_language",
  "timezone",
  "country_id",
  "region_id",
  "organization_id",
  "church_id",
  "ministry_position",
  "group_id",
  "cohort_id",
  "created_at",
  "updated_at",
].join(", ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedProfileField(field: string): field is AllowedProfileField {
  return allowedProfileFields.includes(field as AllowedProfileField);
}

function validateUpdateValue(field: string, value: unknown) {
  if (value === null || typeof value === "string") {
    if (field === "preferred_language") {
      if (value === null || value === "ko" || value === "en" || value === "th") {
        return null;
      }

      return {
        code: "INVALID_LANGUAGE" as const,
        message: "기본 언어는 ko, en, th 중에서 선택해 주세요.",
      };
    }

    if (field === "timezone" && typeof value === "string" && value.trim()) {
      if (!normalizeTimezone(value)) {
        return {
          code: "INVALID_PROFILE_FIELD_VALUE" as const,
          message: "시간대는 올바른 IANA timezone으로 입력해 주세요.",
        };
      }
    }

    if (
      field === "ministry_position" &&
      typeof value === "string" &&
      value.trim().length > 100
    ) {
      return {
        code: "INVALID_PROFILE_FIELD_VALUE" as const,
        message: "소속 직분은 100자 이하로 입력해 주세요.",
      };
    }

    return null;
  }

  return {
    code: "INVALID_PROFILE_FIELD_VALUE" as const,
    message: `${field} 값은 문자열 또는 null이어야 합니다.`,
  };
}

function buildUpdatePayload(body: Record<string, unknown>) {
  const disallowedFields = Object.keys(body).filter(
    (field) => !isAllowedProfileField(field),
  );

  if (disallowedFields.length > 0) {
    return {
      payload: null,
      error: {
        code: "DISALLOWED_PROFILE_FIELDS" as const,
        message: "수정할 수 없는 필드가 포함되어 있습니다.",
        fields: disallowedFields,
      },
    };
  }

  const payload: SelfUpdatePayload = {};

  for (const field of allowedProfileFields) {
    if (!(field in body)) {
      continue;
    }

    const valueError = validateUpdateValue(field, body[field]);

    if (valueError) {
      return {
        payload: null,
        error: valueError,
      };
    }

    const value = body[field];
    const normalizedValue =
      field === "timezone" && typeof value === "string"
        ? normalizeTimezone(value)
        : typeof value === "string" && value.trim().length > 0
          ? value.trim()
          : null;

    payload[field] = normalizedValue;
  }

  return { payload, error: null };
}

function getAuditValues(profile: SafeProfile): AuditProfileValues {
  return {
    display_name: profile.display_name,
    preferred_language: profile.preferred_language,
    phone: profile.phone,
    ministry_position: profile.ministry_position,
    timezone: profile.timezone,
  };
}

export async function updateProfile(body: unknown): Promise<UpdateProfileResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      profile: null,
      user: null,
      error: {
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
      },
    };
  }

  if (!isRecord(body)) {
    return {
      profile: null,
      user: session.user,
      error: {
        code: "INVALID_BODY",
        message: "요청 body는 JSON object여야 합니다.",
      },
    };
  }

  const { payload, error: payloadError } = buildUpdatePayload(body);

  if (payloadError || !payload) {
    return {
      profile: null,
      user: session.user,
      error: payloadError,
    };
  }

    if (Object.keys(payload).length === 0) {
    return {
      profile: null,
      user: session.user,
      error: {
        code: "INVALID_BODY",
        message:
          "수정할 필드가 없습니다. display_name, preferred_language, phone, ministry_position, timezone 중 하나를 보내 주세요.",
      },
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const verifiedProfileId = await getVerifiedProfileId();

    const profileQuery = supabase
      .from("profiles")
      .select(safeProfileSelectFields)
      .neq("status", "anonymized")
      .is("deleted_at", null);

    const { data: oldProfile, error: profileError } = verifiedProfileId
      ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
      : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

    if (profileError) {
      return {
        profile: null,
        user: session.user,
        error: {
          code: "PROFILE_QUERY_FAILED",
          message: "프로필을 조회하는 중 오류가 발생했습니다.",
        },
      };
    }

    if (!oldProfile) {
      return {
        profile: null,
        user: session.user,
        error: {
          code: "PROFILE_NOT_FOUND",
          message:
            "수정할 수 있는 프로필을 찾지 못했습니다. 프로필이 없거나 비활성 상태일 수 있습니다.",
        },
      };
    }

    const oldSafeProfile = oldProfile as SafeProfile;
    const profilesTable = supabase.from("profiles") as any;

    const { data: updatedProfile, error: updateError } = await profilesTable
      .update(payload)
      .eq("id", oldSafeProfile.id)
      .neq("status", "anonymized")
      .is("deleted_at", null)
      .select(safeProfileSelectFields)
      .maybeSingle();

    if (updateError || !updatedProfile) {
      return {
        profile: null,
        user: session.user,
        error: {
          code: "PROFILE_UPDATE_FAILED",
          message: "프로필을 수정하는 중 오류가 발생했습니다.",
        },
      };
    }

    const newSafeProfile = updatedProfile as SafeProfile;
    const { client: serviceClient, error: serviceClientError } =
      createSupabaseServiceClient();

    if (!serviceClient) {
      return {
        profile: null,
        user: session.user,
        error: {
          code: "AUDIT_LOG_FAILED",
          message:
            serviceClientError ??
            "감사 로그 기록에 필요한 서버 설정이 준비되지 않았습니다.",
        },
      };
    }

    const auditLogsTable = serviceClient.from("audit_logs") as any;

    const { error: auditError } = await auditLogsTable.insert({
      actor_id: newSafeProfile.id,
      action: "profile_self_updated",
      table_name: "profiles",
      record_id: newSafeProfile.id,
      old_values: getAuditValues(oldSafeProfile),
      new_values: getAuditValues(newSafeProfile),
      reason: "User updated own safe profile fields.",
    });

    if (auditError) {
      return {
        profile: null,
        user: session.user,
        error: {
          code: "AUDIT_LOG_FAILED",
          message: "감사 로그 기록 중 오류가 발생했습니다.",
        },
      };
    }

    return {
      profile: newSafeProfile,
      user: session.user,
      error: null,
    };
  } catch {
    return {
      profile: null,
      user: session.user,
      error: {
        code: "PROFILE_QUERY_FAILED",
        message: "프로필을 처리하는 중 오류가 발생했습니다.",
      },
    };
  }
}
