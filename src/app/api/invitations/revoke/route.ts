import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { InvitationStatus, ScopeType, UserRole } from "@/types/database";


const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type RevokeInvitationBody = {
  invitation_id?: unknown;
};

type Invitation = {
  id: string;
  invited_email: string;
  invited_role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: InvitationStatus;
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

function normalizeInvitationId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getCurrentSuperAdminProfile() {
  const session = await getSession();

  if (!session.user) {
    return {
      profile: null,
      error: "UNAUTHORIZED" as const,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .neq("status", "anonymized")
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      profile: null,
      error: "FORBIDDEN" as const,
    };
  }

  const profileRecord = profile as { id: string };
  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("profile_id", profileRecord.id)
    .eq("role", "super_admin")
    .eq("scope_type", "global")
    .is("scope_id", null)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  if (roleError || !role) {
    return {
      profile: null,
      error: "FORBIDDEN" as const,
    };
  }

  return {
    profile: profileRecord,
    error: null,
  };
}

export async function POST(request: Request) {
  let body: RevokeInvitationBody;

  try {
    body = (await request.json()) as RevokeInvitationBody;
  } catch {
    return jsonError(400, "INVALID_BODY", "요청 본문이 올바른 JSON 형식이 아닙니다.");
  }

  const invitationId = normalizeInvitationId(body.invitation_id);

  if (!invitationId) {
    return jsonError(400, "MISSING_INVITATION_ID", "초대 ID가 없습니다.");
  }

  const { profile, error: authError } = await getCurrentSuperAdminProfile();

  if (authError === "UNAUTHORIZED") {
    return jsonError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  if (!profile) {
    return jsonError(403, "FORBIDDEN", "초대 취소 권한이 없습니다.");
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Invitation revoke service client is unavailable.",
    );
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      "초대 취소에 필요한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const invitationsTable = serviceClient.from("invitations") as any;
  const { data, error: invitationError } = await invitationsTable
    .select("id, invited_email, invited_role, scope_type, scope_id, status")
    .eq("id", invitationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (invitationError || !data) {
    return jsonError(404, "INVITATION_NOT_FOUND", "초대를 찾을 수 없습니다.");
  }

  const invitation = data as Invitation;

  if (invitation.status !== "pending") {
    return jsonError(
      409,
      "INVITATION_NOT_PENDING",
      "대기 중인 초대만 취소할 수 있습니다.",
    );
  }

  const now = new Date().toISOString();
  const { data: revokedInvitation, error: revokeError } = await invitationsTable
    .update({
      status: "revoked",
      updated_at: now,
    })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .is("deleted_at", null)
    .select("id")
    .single();

  if (revokeError || !revokedInvitation) {
    return jsonError(
      409,
      "INVITATION_NOT_PENDING",
      "대기 중인 초대만 취소할 수 있습니다.",
    );
  }

  const auditLogsTable = serviceClient.from("audit_logs") as any;
  const { error: auditError } = await auditLogsTable.insert({
    actor_id: profile.id,
    action: "invitation_revoked",
    table_name: "invitations",
    record_id: invitation.id,
    old_values: null,
    new_values: {
      invitation_id: invitation.id,
      revoked_by: profile.id,
      invited_email: invitation.invited_email,
      invited_role: invitation.invited_role,
      scope_type: invitation.scope_type,
      scope_id: invitation.scope_id,
    },
    reason: "Super admin revoked an invitation.",
  });

  if (auditError) {
    logServerError(
      "AUDIT_LOG_FAILED",
      auditError.message ?? "Failed to write revoke audit log.",
    );
    return jsonError(500, "AUDIT_LOG_FAILED", "감사 로그 기록 중 오류가 발생했습니다.");
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        invitation_id: invitation.id,
        status: "revoked",
      },
    },
    {
      headers: noStoreHeaders,
    },
  );
}
