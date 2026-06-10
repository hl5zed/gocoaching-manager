import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeTimezone } from "@/lib/timezone";
import type { ProfileUpdate } from "@/types/database";

export type UpdateMyProfileInput = {
  display_name?: unknown;
  phone?: unknown;
  ministry_position?: unknown;
  timezone?: unknown;
};

export type UpdateMyProfileResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHORIZED"
          | "PROFILE_NOT_FOUND"
          | "INVALID_DISPLAY_NAME"
          | "INVALID_PHONE"
          | "INVALID_MINISTRY_POSITION"
          | "INVALID_TIMEZONE"
          | "PROFILE_UPDATE_FAILED";
        message: string;
      };
    };

type NormalizedTextField =
  | { ok: true; value: string | null }
  | { ok: false };

type ProfileIdRecord = {
  id: string;
};

type NormalizedTimezoneField =
  | { ok: true; value: string | null }
  | { ok: false };

function normalizeTextField(value: unknown, maxLength: number) {
  if (value === undefined || value === null) {
    return {
      ok: true as const,
      value: null,
    } satisfies NormalizedTextField;
  }

  if (typeof value !== "string") {
    return { ok: false as const } satisfies NormalizedTextField;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true as const, value: null } satisfies NormalizedTextField;
  }

  if (trimmed.length > maxLength) {
    return { ok: false as const } satisfies NormalizedTextField;
  }

  return {
    ok: true as const,
    value: trimmed,
  } satisfies NormalizedTextField;
}

function normalizeTimezoneField(value: unknown) {
  if (value === undefined || value === null) {
    return {
      ok: true as const,
      value: null,
    } satisfies NormalizedTimezoneField;
  }

  if (typeof value !== "string") {
    return { ok: false as const } satisfies NormalizedTimezoneField;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return {
      ok: true as const,
      value: null,
    } satisfies NormalizedTimezoneField;
  }

  const timezone = normalizeTimezone(trimmed);
  if (!timezone) {
    return { ok: false as const } satisfies NormalizedTimezoneField;
  }

  return {
    ok: true as const,
    value: timezone,
  } satisfies NormalizedTimezoneField;
}

export async function updateMyProfile(
  input: UpdateMyProfileInput,
): Promise<UpdateMyProfileResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    };
  }

  const normalizedDisplayName = normalizeTextField(input.display_name, 120);
  const normalizedPhone = normalizeTextField(input.phone, 50);
  const normalizedMinistryPosition = normalizeTextField(
    input.ministry_position,
    100,
  );
  const normalizedTimezone = normalizeTimezoneField(input.timezone);

  if (!normalizedDisplayName.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_DISPLAY_NAME",
        message: "표시 이름은 120자 이하로 입력해 주세요.",
      },
    };
  }

  if (!normalizedPhone.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_PHONE",
        message: "전화번호는 50자 이하로 입력해 주세요.",
      },
    };
  }

  if (!normalizedMinistryPosition.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_MINISTRY_POSITION",
        message: "소속 직분은 100자 이하로 입력해 주세요.",
      },
    };
  }

  if (!normalizedTimezone.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_TIMEZONE",
        message: "개인 시간대는 올바른 IANA timezone으로 선택해 주세요.",
      },
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const profilesTable = supabase.from("profiles") as unknown as {
      select: (
        columns: string,
      ) => {
        eq: (
          column: "auth_user_id",
          value: string,
        ) => {
          is: (
            column: "deleted_at",
            value: null,
          ) => {
            neq: (
              column: "status",
              value: "anonymized",
            ) => {
              maybeSingle: () => Promise<{
                data: ProfileIdRecord | null;
                error: { message?: string } | null;
              }>;
            };
          };
        };
      };
      update: (
        values: Pick<
          ProfileUpdate,
          | "display_name"
          | "phone"
          | "ministry_position"
          | "timezone"
          | "updated_at"
        >,
      ) => {
        eq: (
          column: "id",
          value: string,
        ) => {
          eq: (
            column: "auth_user_id",
            value: string,
          ) => {
            is: (
              column: "deleted_at",
              value: null,
            ) => {
              neq: (
                column: "status",
                value: "anonymized",
              ) => Promise<{
                error: { message?: string } | null;
              }>;
            };
          };
        };
      };
    };

    const { data: profile, error: profileError } = await profilesTable
      .select("id")
      .eq("auth_user_id", session.user.id)
      .is("deleted_at", null)
      .neq("status", "anonymized")
      .maybeSingle();

    if (profileError) {
      return {
        ok: false,
        error: {
          code: "PROFILE_UPDATE_FAILED",
          message: "Unable to update your profile right now.",
        },
      };
    }

    if (!profile) {
      return {
        ok: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "Your profile has not been created yet.",
        },
      };
    }

    const payload: Pick<
      ProfileUpdate,
      | "display_name"
      | "phone"
      | "ministry_position"
      | "timezone"
      | "updated_at"
    > = {
      display_name: normalizedDisplayName.value,
      phone: normalizedPhone.value,
      ministry_position: normalizedMinistryPosition.value,
      timezone: normalizedTimezone.value,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await profilesTable
      .update(payload)
      .eq("id", profile.id)
      .eq("auth_user_id", session.user.id)
      .is("deleted_at", null)
      .neq("status", "anonymized");

    if (updateError) {
      return {
        ok: false,
        error: {
          code: "PROFILE_UPDATE_FAILED",
          message: "Unable to update your profile right now.",
        },
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: {
        code: "PROFILE_UPDATE_FAILED",
        message: "Unable to update your profile right now.",
      },
    };
  }
}
