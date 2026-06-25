import { NextResponse } from "next/server";
import { updateDailyRecord } from "@/lib/api/my-coaching/daily-records";
import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";


const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type QueryError = {
  code?: string;
  details?: string;
  message?: string;
};

type DailyDeleteAdminClient = {
  from: {
    (table: "profiles"): {
      select: (columns: "id") => {
        eq: (column: "auth_user_id" | "id", value: string) => {
          neq: (column: "status", value: "anonymized") => {
            is: (column: "deleted_at", value: null) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: QueryError | null;
              }>;
            };
          };
        };
      };
    };
    (table: "daily_records"): {
      select: (columns: "id, profile_id, deleted_at") => {
        eq: (column: "id", value: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              profile_id: string;
              deleted_at: string | null;
            } | null;
            error: QueryError | null;
          }>;
        };
      };
      update: (values: { deleted_at: string; updated_at: string }) => {
        eq: (column: "id", value: string) => {
          eq: (column: "profile_id", value: string) => {
            is: (column: "deleted_at", value: null) => Promise<{
              error: QueryError | null;
            }>;
          };
        };
      };
    };
  };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(
  body: Record<string, unknown>,
  status: 200 | 400 | 401 | 403 | 404 | 409 | 500,
) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function logDailyDeleteFailure(
  reason: string,
  metadata: {
    currentProfileId?: string | null;
    details?: string;
    id?: string;
    message?: string;
    code?: string;
  },
) {
  console.error("[DAILY_RECORD_DELETE_FAILED]", {
    reason,
    currentProfileIdExists: Boolean(metadata.currentProfileId),
    details: metadata.details,
    id: metadata.id,
    message: metadata.message,
    code: metadata.code,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const input = await readJson(request);
  const result = await updateDailyRecord(id, input);

  if (!result.ok) {
    return jsonResponse(
      {
        ok: false,
        message: result.message,
      },
      result.status,
    );
  }

  return jsonResponse(
    {
      ok: true,
      record: result.data,
      message: "하루 기록이 수정되었습니다.",
    },
    200,
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id || !UUID_PATTERN.test(id)) {
    return jsonResponse(
      {
        ok: false,
        message: "하루 기록 ID를 확인할 수 없습니다.",
      },
      400,
    );
  }

  const session = await getSession();

  if (!session.user) {
    return jsonResponse(
      {
        ok: false,
        message: "로그인이 필요합니다.",
      },
      401,
    );
  }

  const { client: adminClient, error: adminClientError } =
    createSupabaseAdminClient();

  if (adminClientError || !adminClient) {
    logDailyDeleteFailure("admin client unavailable", {
      id,
      message: adminClientError ?? undefined,
    });
    return jsonResponse(
      {
        ok: false,
        message: "하루 기록 처리에 실패했습니다.",
      },
      500,
    );
  }

  const admin = adminClient as unknown as DailyDeleteAdminClient;
  const verifiedProfileId = await getVerifiedProfileId();

  const { data: currentProfile, error: profileError } = verifiedProfileId
    ? await admin
        .from("profiles")
        .select("id")
        .eq("id", verifiedProfileId)
        .neq("status", "anonymized")
        .is("deleted_at", null)
        .maybeSingle()
    : await admin
        .from("profiles")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .neq("status", "anonymized")
        .is("deleted_at", null)
        .maybeSingle();

  if (profileError) {
    logDailyDeleteFailure("profile lookup failed", {
      id,
      message: profileError.message,
      code: profileError.code,
      details: profileError.details,
    });
    return jsonResponse(
      {
        ok: false,
        message: "하루 기록 처리에 실패했습니다.",
      },
      500,
    );
  }

  if (!currentProfile) {
    return jsonResponse(
      {
        ok: false,
        message: "현재 로그인 사용자의 프로필을 찾을 수 없습니다.",
      },
      404,
    );
  }

  const { data: dailyRecord, error: lookupError } = await admin
    .from("daily_records")
    .select("id, profile_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    logDailyDeleteFailure("daily record lookup failed", {
      currentProfileId: currentProfile.id,
      id,
      message: lookupError.message,
      code: lookupError.code,
      details: lookupError.details,
    });
    return jsonResponse(
      {
        ok: false,
        message: "하루 기록 처리에 실패했습니다.",
      },
      500,
    );
  }

  if (!dailyRecord || dailyRecord.deleted_at) {
    return jsonResponse(
      {
        ok: false,
        message: "하루 기록을 찾을 수 없습니다.",
      },
      404,
    );
  }

  if (dailyRecord.profile_id !== currentProfile.id) {
    return jsonResponse(
      {
        ok: false,
        message: "이 하루 기록에 접근할 권한이 없습니다.",
      },
      403,
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("daily_records")
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("profile_id", currentProfile.id)
    .is("deleted_at", null);

  if (updateError) {
    logDailyDeleteFailure("daily record soft delete failed", {
      currentProfileId: currentProfile.id,
      id,
      message: updateError.message,
      code: updateError.code,
      details: updateError.details,
    });
    return jsonResponse(
      {
        ok: false,
        message: "하루 기록 처리에 실패했습니다.",
      },
      500,
    );
  }

  return jsonResponse(
    {
      ok: true,
      message: "하루 기록이 목록에서 제거되었습니다.",
    },
    200,
  );
}
