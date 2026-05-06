import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileUpdate } from "@/types/database";

export type UpdateMyProfileInput = {
  full_name?: unknown;
  display_name?: unknown;
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
          | "INVALID_FULL_NAME"
          | "INVALID_DISPLAY_NAME"
          | "PROFILE_UPDATE_FAILED";
        message: string;
      };
    };

type NormalizedNameField =
  | { ok: true; value: string | null }
  | { ok: false };

type ProfileIdRecord = {
  id: string;
};

function normalizeNameField(value: unknown) {
  if (value === undefined || value === null) {
    return {
      ok: true as const,
      value: null,
    } satisfies NormalizedNameField;
  }

  if (typeof value !== "string") {
    return { ok: false as const } satisfies NormalizedNameField;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true as const, value: null } satisfies NormalizedNameField;
  }

  if (trimmed.length > 120) {
    return { ok: false as const } satisfies NormalizedNameField;
  }

  return {
    ok: true as const,
    value: trimmed,
  } satisfies NormalizedNameField;
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

  const normalizedFullName = normalizeNameField(input.full_name);
  const normalizedDisplayName = normalizeNameField(input.display_name);

  if (!normalizedFullName.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_FULL_NAME",
        message: "Full name must be 120 characters or fewer.",
      },
    };
  }

  if (!normalizedDisplayName.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_DISPLAY_NAME",
        message: "Display name must be 120 characters or fewer.",
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
        values: Pick<ProfileUpdate, "full_name" | "display_name" | "updated_at">,
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
      "full_name" | "display_name" | "updated_at"
    > = {
      full_name: normalizedFullName.value,
      display_name: normalizedDisplayName.value,
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
