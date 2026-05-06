import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  INVITATION_STATUSES,
  USER_ROLES,
  type InvitationRow,
  type InvitationStatus,
  type ScopeType,
  type UserRole,
} from "@/types/database";

type StatusFilter = InvitationStatus | "all";
type RoleFilter = UserRole | "all";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type AdminInvitationRow = Pick<
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
  | "invited_by"
>;

export type AdminInvitationSummary = {
  id: string;
  email: string;
  invited_role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  invited_by: string | null;
};

export type AdminInvitationsResult = {
  invitations: AdminInvitationSummary[];
  error: string | null;
  page: number;
  limit: number;
  hasNext: boolean;
};

export function normalizeAdminInvitationSearch(
  value: string | string[] | undefined,
) {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  return resolved.trim().slice(0, 100);
}

export function normalizeAdminInvitationStatus(
  value: string | string[] | undefined,
): StatusFilter {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";

  if (resolved === "all") {
    return "all";
  }

  return INVITATION_STATUSES.includes(resolved as InvitationStatus)
    ? (resolved as InvitationStatus)
    : "all";
}

export function normalizeAdminInvitationRole(
  value: string | string[] | undefined,
): RoleFilter {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";

  if (resolved === "all") {
    return "all";
  }

  return USER_ROLES.includes(resolved as UserRole)
    ? (resolved as UserRole)
    : "all";
}

export function normalizeAdminInvitationsPage(
  value: string | string[] | undefined,
): number {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const parsed = Number.parseInt(resolved, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export async function getAdminInvitations({
  q,
  role,
  status,
  page,
  limit = DEFAULT_LIMIT,
}: {
  q: string;
  role: RoleFilter;
  status: StatusFilter;
  page: number;
  limit?: number;
}): Promise<AdminInvitationsResult> {
  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[ADMIN_INVITATIONS_CLIENT] service client unavailable");
    return {
      invitations: [],
      error: "Unable to load invitations right now.",
      page,
      limit: DEFAULT_LIMIT,
      hasNext: false,
    };
  }

  const client = serviceClient;
  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const safePage = Math.max(page, 1);
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit;

  let query = client
    .from("invitations")
    .select(
      "id, invited_email, invited_role, scope_type, scope_id, status, expires_at, accepted_at, created_at, invited_by",
    )
    .is("deleted_at", null);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (role !== "all") {
    query = query.eq("invited_role", role);
  }

  if (q.length > 0) {
    const escapedQuery = q.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.ilike("invited_email", `%${escapedQuery}%`);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[ADMIN_INVITATIONS_QUERY] invitation lookup failed");
    return {
      invitations: [],
      error: "Unable to load invitations right now.",
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  const invitationRows = ((data ?? []) as AdminInvitationRow[]).slice(
    0,
    safeLimit,
  );
  const hasNext = (data?.length ?? 0) > safeLimit;

  return {
    invitations: invitationRows.map((invitation) => ({
      id: invitation.id,
      email: invitation.invited_email,
      invited_role: invitation.invited_role,
      scope_type: invitation.scope_type,
      scope_id: invitation.scope_id,
      status: invitation.status,
      expires_at: invitation.expires_at,
      accepted_at: invitation.accepted_at,
      created_at: invitation.created_at,
      invited_by: invitation.invited_by,
    })),
    error: null,
    page: safePage,
    limit: safeLimit,
    hasNext,
  };
}
