import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  type InvitationRow,
  type InvitationStatus,
  type ProfileRow,
  type ScopeType,
  type UserRole,
} from "@/types/database";

type InvitationDetailRow = Pick<
  InvitationRow,
  | "id"
  | "invited_email"
  | "invited_role"
  | "scope_type"
  | "scope_id"
  | "status"
  | "expires_at"
  | "accepted_at"
  | "created_at"
  | "updated_at"
  | "invited_by"
  | "deleted_at"
>;

type InviterProfileRow = Pick<
  ProfileRow,
  "display_name" | "full_name" | "email"
>;

export type AdminInvitationDetail = {
  id: string;
  email: string;
  invited_role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  invited_by: string | null;
  deleted_at: string | null;
  inviter: InviterProfileRow | null;
};

export type AdminInvitationDetailResult =
  | {
      kind: "success";
      invitation: AdminInvitationDetail;
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "error";
      message: string;
    };

export async function getAdminInvitationDetail(
  invitationId: string,
): Promise<AdminInvitationDetailResult> {
  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[ADMIN_INVITATION_DETAIL_CLIENT] service client unavailable");
    return {
      kind: "error",
      message: "Unable to load invitation right now.",
    };
  }

  const { data, error } = await serviceClient
    .from("invitations")
    .select(
      "id, invited_email, invited_role, scope_type, scope_id, status, expires_at, accepted_at, created_at, updated_at, invited_by, deleted_at",
    )
    .eq("id", invitationId)
    .maybeSingle();

  if (error) {
    console.error("[ADMIN_INVITATION_DETAIL_QUERY] invitation lookup failed");
    return {
      kind: "error",
      message: "Unable to load invitation right now.",
    };
  }

  const invitation = (data as InvitationDetailRow | null) ?? null;

  if (!invitation || invitation.deleted_at !== null) {
    return {
      kind: "not_found",
    };
  }

  let inviter: InviterProfileRow | null = null;

  if (invitation.invited_by) {
    const { data: inviterData } = await serviceClient
      .from("profiles")
      .select("display_name, full_name, email")
      .eq("id", invitation.invited_by)
      .is("deleted_at", null)
      .maybeSingle();

    inviter = (inviterData as InviterProfileRow | null) ?? null;
  }

  return {
    kind: "success",
    invitation: {
      id: invitation.id,
      email: invitation.invited_email,
      invited_role: invitation.invited_role,
      scope_type: invitation.scope_type,
      scope_id: invitation.scope_id,
      status: invitation.status,
      expires_at: invitation.expires_at,
      accepted_at: invitation.accepted_at,
      created_at: invitation.created_at,
      updated_at: invitation.updated_at,
      invited_by: invitation.invited_by,
      deleted_at: invitation.deleted_at,
      inviter,
    },
  };
}
