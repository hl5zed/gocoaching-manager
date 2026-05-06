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
