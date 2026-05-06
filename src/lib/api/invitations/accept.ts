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

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type AcceptInvitationBody = {
  token?: unknown;
};

type InvitationPreview = {
  invited_email: string;
};

type RpcError = {
  message?: string;
};

type AcceptInvitationRpcResponse = {
  data: Json | null;
  error: RpcError | null;
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

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function getDisplayNameFromEmail(email: string) {
  return email.split("@")[0] || email;
}

async function findInvitationPreview(
  serviceClient: SupabaseClient,
  tokenHash: string,
) {
  const { data, error } = await serviceClient
    .from("invitations")
    .select("invited_email")
    .eq("token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as InvitationPreview;
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

  const rawToken = normalizeToken(body.token);

  if (!rawToken) {
    return jsonError(400, "MISSING_TOKEN", "초대 토큰이 없습니다.");
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
  const invitationPreview = await findInvitationPreview(serviceClient, tokenHash);

  if (
    invitationPreview &&
    normalizeEmail(invitationPreview.invited_email) !== authEmail
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

  return NextResponse.json(
    {
      ok: true,
      data: {
        invitation_id: acceptedInvitation.invitation.id,
        profile_id: acceptedInvitation.profile_id,
        role: acceptedInvitation.role,
        status: acceptedInvitation.invitation.status,
      },
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}
