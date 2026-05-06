import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  SCOPE_TYPES,
  USER_ROLES,
  type ScopeType,
  type UserRole,
} from "@/types/database";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const pendingInvitationMessage =
  "이미 대기 중인 초대가 있습니다. 기존 초대를 사용하거나 취소 후 다시 생성해 주세요.";

const allowedRoles = new Set<UserRole>(USER_ROLES);

const allowedScopes = new Set<ScopeType>(SCOPE_TYPES);

type InvitationRequestBody = {
  invited_email?: unknown;
  invited_role?: unknown;
  scope_type?: unknown;
  scope_id?: unknown;
  expires_in_days?: unknown;
};

type CurrentProfile = {
  id: string;
};

type ExistingPendingInvitation = {
  id: string;
  invited_email: string;
  expires_at: string;
};

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

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

function jsonPendingInvitationError() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVITATION_ALREADY_PENDING",
        message: pendingInvitationMessage,
      },
    },
    {
      status: 409,
      headers: noStoreHeaders,
    },
  );
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isProbablyEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeExpiresInDays(value: unknown) {
  if (value === undefined || value === null) {
    return 7;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  if (value < 1 || value > 30) {
    return null;
  }

  return value;
}

function createExpiresAt(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function createInvitationToken() {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  return { rawToken, tokenHash };
}

function createInvitationUrl(request: Request, rawToken: string) {
  const origin = new URL(request.url).origin;
  return `${origin}/invitations/accept?token=${encodeURIComponent(rawToken)}`;
}

async function getCurrentProfile() {
  const session = await getSession();

  if (!session.user) {
    return {
      profile: null,
      error: "UNAUTHORIZED" as const,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .neq("status", "anonymized")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return {
      profile: null,
      error: "FORBIDDEN" as const,
    };
  }

  return {
    profile: data as CurrentProfile,
    error: null,
  };
}

async function hasActiveSuperAdminGlobalRole(profileId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("profile_id", profileId)
    .eq("role", "super_admin")
    .eq("scope_type", "global")
    .is("scope_id", null)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  return !error && Boolean(data);
}

async function findExistingPendingInvitation(
  invitationsTable: any,
  invitedEmail: string,
  invitedRole: UserRole,
  scopeType: ScopeType,
  scopeId: string | null,
) {
  let query = invitationsTable
    .select("id, invited_email, expires_at")
    .eq("invited_role", invitedRole)
    .eq("scope_type", scopeType)
    .eq("status", "pending")
    .is("deleted_at", null)
    .limit(10);

  query =
    scopeId === null ? query.is("scope_id", null) : query.eq("scope_id", scopeId);

  const { data, error } = await query;

  if (error) {
    return {
      invitation: null,
      error,
    };
  }

  const invitation =
    (data as ExistingPendingInvitation[] | null)?.find(
      (item) => item.invited_email.trim().toLowerCase() === invitedEmail,
    ) ?? null;

  return {
    invitation,
    error: null,
  };
}

function isPendingInvitationUniqueError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const postgrestError = error as {
    code?: string;
    details?: string;
    message?: string;
  };
  const errorText = `${postgrestError.message ?? ""} ${
    postgrestError.details ?? ""
  }`;

  return (
    postgrestError.code === "23505" &&
    (errorText.includes("uq_invitations_pending_global") ||
      errorText.includes("uq_invitations_pending_scoped"))
  );
}

export async function POST(request: Request) {
  const { profile, error: profileError } = await getCurrentProfile();

  if (profileError === "UNAUTHORIZED") {
    return jsonError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  if (!profile) {
    return jsonError(403, "FORBIDDEN", "초대 생성 권한이 없습니다.");
  }

  const isSuperAdmin = await hasActiveSuperAdminGlobalRole(profile.id);

  if (!isSuperAdmin) {
    return jsonError(403, "FORBIDDEN", "초대 생성 권한이 없습니다.");
  }

  let body: InvitationRequestBody;

  try {
    body = (await request.json()) as InvitationRequestBody;
  } catch {
    return jsonError(400, "INVALID_BODY", "요청 본문이 올바른 JSON 형식이 아닙니다.");
  }

  const invitedEmail = normalizeEmail(body.invited_email);
  const invitedRole =
    typeof body.invited_role === "string" ? body.invited_role : "";
  const scopeType = typeof body.scope_type === "string" ? body.scope_type : "";
  const scopeId =
    typeof body.scope_id === "string" && body.scope_id.trim().length > 0
      ? body.scope_id.trim()
      : null;
  const expiresInDays = normalizeExpiresInDays(body.expires_in_days);

  if (!isProbablyEmail(invitedEmail)) {
    return jsonError(400, "INVALID_EMAIL", "유효한 이메일을 입력해 주세요.");
  }

  if (!allowedRoles.has(invitedRole as UserRole)) {
    return jsonError(400, "INVALID_ROLE", "초대 역할 값이 올바르지 않습니다.");
  }

  if (!allowedScopes.has(scopeType as ScopeType)) {
    return jsonError(400, "INVALID_SCOPE", "초대 scope_type 값이 올바르지 않습니다.");
  }

  if (scopeType === "global" && scopeId !== null) {
    return jsonError(
      400,
      "INVALID_SCOPE",
      "global scope에서는 scope_id가 null이어야 합니다.",
    );
  }

  if (scopeType !== "global" && scopeId === null) {
    return jsonError(
      400,
      "INVALID_SCOPE",
      "global이 아닌 scope에서는 scope_id가 필요합니다.",
    );
  }

  if (expiresInDays === null) {
    return jsonError(
      400,
      "INVALID_EXPIRY",
      "expires_in_days는 1일에서 30일 사이의 정수여야 합니다.",
    );
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Invitation service client is unavailable.",
    );
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      "초대 생성에 필요한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const invitationsTable = serviceClient.from("invitations") as any;
  const existingPending = await findExistingPendingInvitation(
    invitationsTable,
    invitedEmail,
    invitedRole as UserRole,
    scopeType as ScopeType,
    scopeId,
  );

  if (existingPending.error) {
    logServerError(
      "INVITATION_LOOKUP_FAILED",
      existingPending.error.message ?? "Failed to check pending invitation.",
    );
    return jsonError(
      500,
      "INVITATION_LOOKUP_FAILED",
      "기존 대기 중 초대를 확인하는 중 오류가 발생했습니다.",
    );
  }

  if (existingPending.invitation) {
    return jsonPendingInvitationError();
  }

  const { rawToken, tokenHash } = createInvitationToken();
  const expiresAt = createExpiresAt(expiresInDays);

  const { data: invitation, error: invitationError } = await invitationsTable
    .insert({
      invited_email: invitedEmail,
      invited_role: invitedRole,
      scope_type: scopeType,
      scope_id: scopeId,
      invited_by: profile.id,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();

  if (invitationError || !invitation) {
    if (isPendingInvitationUniqueError(invitationError)) {
      return jsonPendingInvitationError();
    }

    logServerError(
      "INVITATION_CREATE_FAILED",
      invitationError?.message ?? "Failed to create invitation.",
    );
    return jsonError(
      500,
      "INVITATION_CREATE_FAILED",
      "초대 저장 중 오류가 발생했습니다.",
    );
  }

  const auditLogsTable = serviceClient.from("audit_logs") as any;
  const { error: auditError } = await auditLogsTable.insert({
    actor_id: profile.id,
    action: "invitation_created",
    table_name: "invitations",
    record_id: invitation.id,
    old_values: null,
    new_values: {
      invitation_id: invitation.id,
      invited_email: invitedEmail,
      invited_role: invitedRole,
      scope_type: scopeType,
      scope_id: scopeId,
      expires_at: invitation.expires_at,
    },
    reason: "Super admin created an invitation.",
  });

  if (auditError) {
    logServerError(
      "AUDIT_LOG_FAILED",
      auditError.message ?? "Failed to write invitation audit log.",
    );
    return jsonError(500, "AUDIT_LOG_FAILED", "감사 로그 기록 중 오류가 발생했습니다.");
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        invitation_id: invitation.id,
        invitation_url: createInvitationUrl(request, rawToken),
        expires_at: invitation.expires_at,
      },
    },
    {
      status: 201,
      headers: noStoreHeaders,
    },
  );
}
