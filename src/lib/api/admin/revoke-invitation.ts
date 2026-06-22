import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  type AuditLogInsert,
  type Database,
  type InvitationRow,
  type InvitationStatus,
  type ScopeType,
  type UserRole,
} from "@/types/database";

const adminScopeRoles = new Set<UserRole>([
  "church_admin",
  "organization_admin",
  "country_admin",
]);

type AdminRoleScopeRow = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
};

type InvitationScopeTarget = {
  scope_type: ScopeType;
  scope_id: string | null;
};

type InvitationScopeAccessError = {
  status: number;
  code: string;
  message: string;
};

async function loadAdminRoleScopes(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<AdminRoleScopeRow[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, scope_type, scope_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    return [];
  }

  return ((data ?? []) as AdminRoleScopeRow[]).filter((row) =>
    adminScopeRoles.has(row.role),
  );
}

function adminCanManageInvitationScope(
  adminRoles: UserRole[],
  adminScopes: AdminRoleScopeRow[],
  target: InvitationScopeTarget,
): boolean {
  if (adminRoles.includes("super_admin")) {
    return true;
  }

  if (target.scope_type === "global") {
    return false;
  }

  if (!target.scope_id) {
    return false;
  }

  return adminScopes.some(
    (scope) =>
      scope.scope_id !== null &&
      scope.scope_type === target.scope_type &&
      scope.scope_id === target.scope_id,
  );
}

function createInvitationScopeAccessError(): InvitationScopeAccessError {
  return {
    status: 403,
    code: "INVITATION_SCOPE_FORBIDDEN",
    message: "해당 범위의 초대를 관리할 권한이 없습니다.",
  };
}

async function assertAdminInvitationScopeAccess(
  supabase: SupabaseClient<Database>,
  profileId: string,
  adminRoles: UserRole[],
  target: InvitationScopeTarget,
): Promise<{ ok: true } | { ok: false; error: InvitationScopeAccessError }> {
  if (adminRoles.includes("super_admin")) {
    return { ok: true };
  }

  const adminScopes = await loadAdminRoleScopes(supabase, profileId);

  if (adminCanManageInvitationScope(adminRoles, adminScopes, target)) {
    return { ok: true };
  }

  return { ok: false, error: createInvitationScopeAccessError() };
}

type RevocationCheckRow = Pick<
  InvitationRow,
  | "id"
  | "invited_email"
  | "invited_role"
  | "scope_type"
  | "scope_id"
  | "status"
  | "accepted_at"
  | "expires_at"
  | "deleted_at"
>;

type RevokedInvitationRow = Pick<InvitationRow, "id" | "status">;

type PostgrestErrorLike = {
  message?: string;
};

export type RevokeInvitationSuccess = {
  invitation_id: string;
  status: InvitationStatus;
};

export type RevokeInvitationError = {
  status: number;
  code: string;
  message: string;
};

export type RevokeInvitationResult =
  | {
      ok: true;
      data: RevokeInvitationSuccess;
    }
  | {
      ok: false;
      error: RevokeInvitationError;
    };

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

function isExpiredInvitation(invitation: RevocationCheckRow) {
  return (
    invitation.status === "expired" ||
    new Date(invitation.expires_at).getTime() <= Date.now()
  );
}

function isRevokableInvitation(invitation: RevocationCheckRow) {
  return (
    invitation.status === "pending" &&
    invitation.accepted_at === null &&
    invitation.deleted_at === null &&
    new Date(invitation.expires_at).getTime() > Date.now()
  );
}

function createInvitationUpdateTable(serviceClient: SupabaseClient<Database>) {
  type InvitationUpdateChain = {
    eq: (
      column: "id" | "status",
      value: string,
    ) => InvitationUpdateChain;
    is: (
      column: "accepted_at" | "deleted_at",
      value: null,
    ) => InvitationUpdateChain;
    gt: (
      column: "expires_at",
      value: string,
    ) => {
      select: (
        columns: string,
      ) => {
        maybeSingle: () => Promise<{
          data: RevokedInvitationRow | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
  };

  return serviceClient.from("invitations") as unknown as {
    select: (
      columns: string,
    ) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: RevocationCheckRow | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
    update: (
      values: { status: InvitationStatus; updated_at: string },
    ) => InvitationUpdateChain;
  };
}

function createAuditTable(serviceClient: SupabaseClient<Database>) {
  return serviceClient.from("audit_logs") as unknown as {
    insert: (
      values: AuditLogInsert,
    ) => Promise<{
      error: PostgrestErrorLike | null;
    }>;
  };
}

export async function revokeAdminInvitation({
  invitationId,
}: {
  invitationId: string;
}): Promise<RevokeInvitationResult> {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return {
      ok: false,
      error: {
        status: admin.status,
        code: admin.code,
        message: admin.message,
      },
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Invitation revoke service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: "Invitation service is temporarily unavailable.",
      },
    };
  }

  const invitationsTable = createInvitationUpdateTable(serviceClient);
  const { data: invitation, error: invitationError } = await invitationsTable
    .select(
      "id, invited_email, invited_role, scope_type, scope_id, status, accepted_at, expires_at, deleted_at",
    )
    .eq("id", invitationId)
    .maybeSingle();

  if (invitationError) {
    logServerError(
      "INVITATION_LOOKUP_FAILED",
      invitationError.message ?? "Invitation lookup failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "INVITATION_LOOKUP_FAILED",
        message: "Unable to load invitation right now.",
      },
    };
  }

  if (!invitation || invitation.deleted_at !== null) {
    return {
      ok: false,
      error: {
        status: 404,
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found.",
      },
    };
  }

  const scopeAccess = await assertAdminInvitationScopeAccess(
    admin.supabase,
    admin.profile.id,
    admin.roles,
    {
      scope_type: invitation.scope_type,
      scope_id: invitation.scope_id,
    },
  );

  if (!scopeAccess.ok) {
    return {
      ok: false,
      error: scopeAccess.error,
    };
  }

  if (invitation.status === "accepted" || invitation.accepted_at !== null) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "INVITE_ALREADY_ACCEPTED",
        message: "Accepted invitations cannot be revoked.",
      },
    };
  }

  if (invitation.status === "revoked") {
    return {
      ok: false,
      error: {
        status: 409,
        code: "INVITE_ALREADY_REVOKED",
        message: "This invitation has already been revoked.",
      },
    };
  }

  if (isExpiredInvitation(invitation)) {
    return {
      ok: false,
      error: {
        status: 410,
        code: "INVITE_EXPIRED",
        message: "Expired invitations cannot be revoked.",
      },
    };
  }

  if (!isRevokableInvitation(invitation)) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "INVITE_STATE_CHANGED",
        message: "Invitation state changed. Please refresh and try again.",
      },
    };
  }

  const now = new Date().toISOString();
  const { data: revokedInvitation, error: revokeError } = await invitationsTable
    .update({
      status: "revoked",
      updated_at: now,
    })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .is("accepted_at", null)
    .is("deleted_at", null)
    .gt("expires_at", now)
    .select("id, status")
    .maybeSingle();

  if (revokeError) {
    logServerError(
      "INVITATION_REVOKE_FAILED",
      revokeError.message ?? "Invitation revoke failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "INVITATION_REVOKE_FAILED",
        message: "Unable to revoke invitation right now.",
      },
    };
  }

  if (!revokedInvitation) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "INVITE_STATE_CHANGED",
        message: "Invitation state changed. Please refresh and try again.",
      },
    };
  }

  const auditLogsTable = createAuditTable(serviceClient);
  const auditInsert: AuditLogInsert = {
    actor_id: admin.profile.id,
    action: "invitation_revoked",
    table_name: "invitations",
    record_id: invitation.id,
    old_values: {
      status: invitation.status,
      accepted_at: invitation.accepted_at,
      expires_at: invitation.expires_at,
    },
    new_values: {
      invitation_id: invitation.id,
      status: "revoked",
    },
    reason: null,
  };

  const { error: auditError } = await auditLogsTable.insert(auditInsert);

  if (auditError) {
    logServerError(
      "AUDIT_LOG_FAILED",
      auditError.message ?? "Revoke audit log failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "AUDIT_LOG_FAILED",
        message: "Unable to finalize invitation revocation.",
      },
    };
  }

  return {
    ok: true,
    data: {
      invitation_id: revokedInvitation.id,
      status: revokedInvitation.status,
    },
  };
}
