import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/types/database";
import type {
  AcceptInvitationRpcResult,
  DatabaseWithRpc,
  RpcDefinitions,
} from "@/types/rpc";


const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type AcceptInvitationBody = {
  country_id?: unknown;
  generation_number?: unknown;
  ministry_position?: unknown;
  token?: unknown;
};

type InvitationPreview = {
  invited_email: string;
};

type InvitationPreviewResult = {
  data: InvitationPreview | null;
  error: string | null;
};

type RpcError = {
  message?: string;
};

type AcceptInvitationRpcResponse = {
  data: Json | null;
  error: RpcError | null;
};

type InvitationProfileUpdate = {
  country_id: string | null;
  generation_number: number | null;
  ministry_position: string | null;
};

type InvitationAcceptanceRow = {
  accepted_at: string | null;
  accepted_by: string | null;
  id: string;
  invited_email: string;
  status: string;
};

type ProfilesUpdateTable = {
  update: (values: InvitationProfileUpdate) => {
    eq: (column: "id", value: string) => {
      is: (
        column: "deleted_at",
        value: null,
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: noStoreHeaders,
    },
  );
}

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeNullableText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false as const,
      value: null,
    };
  }

  const text = value.trim();

  if (text.length === 0) {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (text.length > maxLength) {
    return {
      ok: false as const,
      value: null,
    };
  }

  return {
    ok: true as const,
    value: text,
  };
}

function normalizeUuid(value: unknown) {
  const result = normalizeNullableText(value, 80);

  if (!result.ok || result.value === null) {
    return result;
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(result.value)
    ? result
    : {
        ok: false as const,
        value: null,
      };
}

function normalizeGenerationNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return {
      ok: true as const,
      value: null,
    };
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
    return {
      ok: false as const,
      value: null,
    };
  }

  return {
    ok: true as const,
    value: parsed,
  };
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function getDisplayNameFromEmail(email: string) {
  return email.split("@")[0] || email;
}

async function findInvitationPreview(
  serviceClient: SupabaseClient,
  tokenHash: string,
): Promise<InvitationPreviewResult> {
  const { data, error } = await serviceClient
    .from("invitations")
    .select("invited_email")
    .eq("token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: error.message ?? "Invitation preview could not be loaded.",
    };
  }

  if (!data) {
    return {
      data: null,
      error: null,
    };
  }

  return {
    data: data as InvitationPreview,
    error: null,
  };
}

function getRpcStatus(error: RpcError) {
  switch (error.message) {
    case "INVITE_NOT_FOUND":
      return {
        status: 404,
        code: "INVITE_NOT_FOUND",
        message: "유효하지 않은 초대입니다.",
      };
    case "INVITE_ALREADY_USED":
      return {
        status: 409,
        code: "INVITE_ALREADY_USED",
        message: "이미 사용된 초대입니다.",
      };
    case "INVITE_EXPIRED":
      return {
        status: 410,
        code: "INVITE_EXPIRED",
        message: "만료된 초대입니다.",
      };
    default:
      return {
        status: 500,
        code: "INVITATION_ACCEPT_FAILED",
        message: "초대 수락 중 오류가 발생했습니다.",
      };
  }
}

function callAcceptInvitationRpc(
  client: SupabaseClient<DatabaseWithRpc>,
  args: RpcDefinitions["accept_invitation"]["Args"],
) {
  const typedClient = client as SupabaseClient<DatabaseWithRpc> & {
    rpc: (
      fn: "accept_invitation",
      params: RpcDefinitions["accept_invitation"]["Args"],
    ) => Promise<AcceptInvitationRpcResponse>;
  };

  return typedClient.rpc("accept_invitation", args);
}

async function ensureInvitationMarkedAccepted({
  authEmail,
  invitationId,
  profileId,
  serviceClient,
}: {
  authEmail: string;
  invitationId: string;
  profileId: string;
  serviceClient: SupabaseClient;
}) {
  const invitationsTable = serviceClient.from("invitations") as any;
  const { data: currentInvitation, error: currentInvitationError } =
    await invitationsTable
      .select("id, invited_email, status, accepted_at, accepted_by")
      .eq("id", invitationId)
      .is("deleted_at", null)
      .maybeSingle();

  if (currentInvitationError || !currentInvitation) {
    return {
      data: null,
      error:
        currentInvitationError?.message ??
        "Accepted invitation could not be verified.",
    };
  }

  const invitation = currentInvitation as InvitationAcceptanceRow;

  if (normalizeEmail(invitation.invited_email) !== authEmail) {
    return {
      data: null,
      error: "Accepted invitation email does not match current user.",
    };
  }

  if (invitation.accepted_by !== null && invitation.accepted_by !== profileId) {
    return {
      data: null,
      error: "Accepted invitation belongs to a different profile.",
    };
  }

  if (
    invitation.status === "accepted" &&
    invitation.accepted_at !== null &&
    invitation.accepted_by === profileId
  ) {
    return {
      data: invitation,
      error: null,
    };
  }

  if (["revoked", "expired", "cancelled", "canceled"].includes(invitation.status)) {
    return {
      data: null,
      error: "Invitation is no longer acceptable.",
    };
  }

  if (invitation.status !== "pending" && invitation.status !== "accepted") {
    return {
      data: null,
      error: "Invitation status cannot be marked accepted.",
    };
  }

  const acceptedAt = invitation.accepted_at ?? new Date().toISOString();
  const { data: updatedInvitation, error: updateError } = await invitationsTable
    .update({
      status: "accepted",
      accepted_at: acceptedAt,
      accepted_by: profileId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id)
    .eq("invited_email", invitation.invited_email)
    .is("deleted_at", null)
    .in("status", ["pending", "accepted"])
    .or(`accepted_by.is.null,accepted_by.eq.${profileId}`)
    .select("id, invited_email, status, accepted_at, accepted_by")
    .maybeSingle();

  if (updateError || !updatedInvitation) {
    return {
      data: null,
      error:
        updateError?.message ??
        "Accepted invitation could not be updated with the expected state.",
    };
  }

  const normalizedUpdatedInvitation =
    updatedInvitation as InvitationAcceptanceRow;

  if (
    normalizedUpdatedInvitation.status !== "accepted" ||
    normalizedUpdatedInvitation.accepted_at === null ||
    normalizedUpdatedInvitation.accepted_by !== profileId
  ) {
    return {
      data: null,
      error: "Accepted invitation verification failed after update.",
    };
  }

  return {
    data: normalizedUpdatedInvitation,
    error: null,
  };
}

export async function POST(request: Request) {
  let body: AcceptInvitationBody;

  try {
    body = (await request.json()) as AcceptInvitationBody;
  } catch {
    return jsonError(
      400,
      "INVALID_BODY",
      "요청 본문이 올바른 JSON 형식이 아닙니다.",
    );
  }

  const session = await getSession();

  if (!session.user) {
    return jsonError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const authEmail = normalizeEmail(session.user.email);

  if (!authEmail) {
    return jsonError(
      403,
      "INVITATION_EMAIL_MISMATCH",
      "이 초대는 현재 로그인한 이메일 계정과 일치하지 않습니다.",
    );
  }

  const rawToken = normalizeToken(body.token);
  const countryId = normalizeUuid(body.country_id);
  const ministryPosition = normalizeNullableText(body.ministry_position, 80);
  const generationNumber = normalizeGenerationNumber(body.generation_number);

  if (!rawToken) {
    return jsonError(400, "MISSING_TOKEN", "초대 토큰이 없습니다.");
  }

  if (!countryId.ok) {
    return jsonError(400, "INVALID_COUNTRY", "소속 국가 값을 확인해 주세요.");
  }

  if (!ministryPosition.ok) {
    return jsonError(400, "INVALID_MINISTRY_POSITION", "소속 직분 값을 확인해 주세요.");
  }

  if (!generationNumber.ok) {
    return jsonError(400, "INVALID_GENERATION", "세대 값을 확인해 주세요.");
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Invitation accept service client is unavailable.",
    );
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      "초대 수락에 필요한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const tokenHash = hashToken(rawToken);
  const invitationPreviewResult = await findInvitationPreview(
    serviceClient,
    tokenHash,
  );

  if (invitationPreviewResult.error) {
    logServerError("INVITATION_PREVIEW_FAILED", invitationPreviewResult.error);
    return jsonError(
      500,
      "INVITATION_PREVIEW_FAILED",
      "초대 정보를 확인하는 중 오류가 발생했습니다.",
    );
  }

  if (!invitationPreviewResult.data) {
    return jsonError(404, "INVITE_NOT_FOUND", "유효하지 않은 초대입니다.");
  }

  if (
    normalizeEmail(invitationPreviewResult.data.invited_email) !== authEmail
  ) {
    return jsonError(
      403,
      "INVITATION_EMAIL_MISMATCH",
      "이 초대는 현재 로그인한 이메일 계정과 일치하지 않습니다.",
    );
  }

  const rpcClient = serviceClient as SupabaseClient<DatabaseWithRpc>;
  const { data, error } = await callAcceptInvitationRpc(rpcClient, {
    p_token: rawToken,
    p_auth_user_id: session.user.id,
    p_email: authEmail,
    p_full_name: null,
    p_display_name: getDisplayNameFromEmail(authEmail),
  });

  if (error) {
    const mapped = getRpcStatus(error);
    logServerError(mapped.code, error.message ?? mapped.message);
    return jsonError(mapped.status, mapped.code, mapped.message);
  }

  const acceptedInvitation = data as AcceptInvitationRpcResult | null;

  if (!acceptedInvitation) {
    logServerError(
      "INVITATION_ACCEPT_FAILED",
      "accept_invitation RPC returned an empty result.",
    );
    return jsonError(
      500,
      "INVITATION_ACCEPT_FAILED",
      "초대 수락 중 오류가 발생했습니다.",
    );
  }

  const invitationAcceptance = await ensureInvitationMarkedAccepted({
    authEmail,
    invitationId: acceptedInvitation.invitation.id,
    profileId: acceptedInvitation.profile_id,
    serviceClient,
  });

  if (invitationAcceptance.error || !invitationAcceptance.data) {
    logServerError(
      "INVITATION_STATUS_UPDATE_FAILED",
      invitationAcceptance.error ??
        "Accepted invitation status verification failed.",
    );
    return jsonError(
      500,
      "INVITATION_STATUS_UPDATE_FAILED",
      "초대 수락 상태를 저장하는 중 오류가 발생했습니다.",
    );
  }

  const profileUpdate: InvitationProfileUpdate = {
    country_id: countryId.value,
    ministry_position: ministryPosition.value,
    generation_number: generationNumber.value,
  };
  const profilesTable = serviceClient.from("profiles") as unknown as ProfilesUpdateTable;
  const { error: profileUpdateError } = await profilesTable
    .update(profileUpdate)
    .eq("id", acceptedInvitation.profile_id)
    .is("deleted_at", null);

  if (profileUpdateError) {
    logServerError(
      "INVITATION_PROFILE_UPDATE_FAILED",
      profileUpdateError.message ?? "Failed to update invitation profile fields.",
    );
    return jsonError(
      500,
      "INVITATION_PROFILE_UPDATE_FAILED",
      "초대 수락 후 프로필 정보를 저장하는 중 오류가 발생했습니다.",
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        invitation_id: acceptedInvitation.invitation.id,
        profile_id: acceptedInvitation.profile_id,
        role: acceptedInvitation.role,
        status: invitationAcceptance.data.status,
      },
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}
