import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import {
  type Database,
  type InvitationRow,
  type InvitationStatus,
  type ProfileRow,
  type ScopeType,
  type UserRole,
} from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthorizedAdminProfile = Extract<
  Awaited<ReturnType<typeof requireAdminProfile>>,
  { ok: true }
>;

const ADMIN_SCOPE_ROLES = new Set<UserRole>([
  "country_admin",
  "organization_admin",
  "church_admin",
]);

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

type AdminRoleScopeRow = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
};

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
    ADMIN_SCOPE_ROLES.has(row.role),
  );
}

async function buildInvitationScopeFilter(
  admin: AuthorizedAdminProfile,
): Promise<string | null> {
  if (admin.roles.includes("super_admin")) {
    return null;
  }

  const scopes = await loadAdminRoleScopes(admin.supabase, admin.profile.id);
  const filters = scopes
    .filter((scope) => scope.scope_id !== null)
    .map(
      (scope) =>
        `and(scope_type.eq.${scope.scope_type},scope_id.eq.${scope.scope_id})`,
    );

  return filters.length > 0 ? filters.join(",") : "";
}

export async function getAdminInvitationDetail(
  invitationId: string,
  authorizedAdmin?: AuthorizedAdminProfile,
): Promise<AdminInvitationDetailResult> {
  const admin = authorizedAdmin ?? (await requireAdminProfile());
  const { client: serviceClient } = createSupabaseServiceClient();

  if (!admin.ok) {
    return {
      kind: "error",
      message: "Admin authorization is required to load invitation detail.",
    };
  }

  if (!serviceClient) {
    console.error("[ADMIN_INVITATION_DETAIL_CLIENT] service client unavailable");
    return {
      kind: "error",
      message: "Unable to load invitation right now.",
    };
  }

  const scopeFilter = await buildInvitationScopeFilter(admin);

  if (scopeFilter === "") {
    return {
      kind: "not_found",
    };
  }

  let query = serviceClient
    .from("invitations")
    .select(
      "id, invited_email, invited_role, scope_type, scope_id, status, expires_at, accepted_at, created_at, updated_at, invited_by, deleted_at",
    )
    .eq("id", invitationId);

  if (scopeFilter) {
    query = query.or(scopeFilter);
  }

  const { data, error } = await query.maybeSingle();

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
