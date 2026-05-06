import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  PROFILE_STATUSES,
  USER_ROLES,
  type ProfileRow,
  type ProfileStatus,
  type ScopeType,
  type UserRole,
  type UserRoleRow,
  type UserRoleStatus,
} from "@/types/database";

type StatusFilter = ProfileStatus | "all";
type RoleFilter = UserRole | "all";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type AdminProfileRow = Pick<
  ProfileRow,
  | "id"
  | "auth_user_id"
  | "full_name"
  | "display_name"
  | "email"
  | "status"
  | "created_at"
>;

type AdminRoleRow = Pick<
  UserRoleRow,
  "id" | "profile_id" | "role" | "scope_type" | "scope_id" | "status" | "granted_at"
>;

export type AdminUserRoleSummary = {
  id: string;
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: UserRoleStatus;
  assigned_at: string;
};

export type AdminUserSummary = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  status: ProfileStatus;
  created_at: string;
  roles: AdminUserRoleSummary[];
};

export type AdminUsersResult = {
  users: AdminUserSummary[];
  error: string | null;
  page: number;
  limit: number;
  hasNext: boolean;
};

export function normalizeAdminUserSearch(value: string | string[] | undefined) {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  return resolved.trim().slice(0, 100);
}

export function normalizeAdminUserStatus(
  value: string | string[] | undefined,
): StatusFilter {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";

  if (resolved === "all") {
    return "all";
  }

  return PROFILE_STATUSES.includes(resolved as ProfileStatus)
    ? (resolved as ProfileStatus)
    : "all";
}

export function normalizeAdminUserRole(
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

export function normalizeAdminUsersPage(
  value: string | string[] | undefined,
): number {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const parsed = Number.parseInt(resolved, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export async function getAdminUsers({
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
}): Promise<AdminUsersResult> {
  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[ADMIN_USERS_CLIENT] service client unavailable");
    return {
      users: [],
      error: "Unable to load users right now.",
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
  let roleFilteredProfileIds: string[] | null = null;

  if (role !== "all") {
    const { data: matchingRoles, error: matchingRolesError } = await client
      .from("user_roles")
      .select("profile_id")
      .eq("role", role)
      .eq("status", "active")
      .is("deleted_at", null);

    if (matchingRolesError) {
      console.error("[ADMIN_USERS_ROLE_FILTER] role lookup failed");
      return {
        users: [],
        error: "Unable to load users right now.",
        page: safePage,
        limit: safeLimit,
        hasNext: false,
      };
    }

    roleFilteredProfileIds = Array.from(
      new Set(
        ((matchingRoles ?? []) as Array<{ profile_id: string | null }>)
          .map((row) => row.profile_id)
          .filter((value): value is string => typeof value === "string"),
      ),
    );

    if (roleFilteredProfileIds.length === 0) {
      return {
        users: [],
        error: null,
        page: safePage,
        limit: safeLimit,
        hasNext: false,
      };
    }
  }

  let profilesQuery = client
    .from("profiles")
    .select("id, auth_user_id, full_name, display_name, email, status, created_at")
    .is("deleted_at", null);

  if (status !== "all") {
    profilesQuery = profilesQuery.eq("status", status);
  }

  if (q.length > 0) {
    const escapedQuery = q.replace(/[%_]/g, (match) => `\\${match}`);
    profilesQuery = profilesQuery.or(
      `full_name.ilike.%${escapedQuery}%,display_name.ilike.%${escapedQuery}%,email.ilike.%${escapedQuery}%`,
    );
  }

  if (roleFilteredProfileIds) {
    profilesQuery = profilesQuery.in("id", roleFilteredProfileIds);
  }

  const { data: profiles, error: profilesError } = await profilesQuery
    .order("created_at", { ascending: false })
    .range(from, to);

  if (profilesError) {
    console.error("[ADMIN_USERS_PROFILES] profile lookup failed");
    return {
      users: [],
      error: "Unable to load users right now.",
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  const profileRows = ((profiles ?? []) as AdminProfileRow[]).slice(0, safeLimit);
  const hasNext = (profiles?.length ?? 0) > safeLimit;

  if (profileRows.length === 0) {
    return {
      users: [],
      error: null,
      page: safePage,
      limit: safeLimit,
      hasNext,
    };
  }

  const profileIds = profileRows.map((profile) => profile.id);

  // Existing project convention: profiles.id -> user_roles.profile_id.
  const { data: roles, error: rolesError } = await client
    .from("user_roles")
    .select("id, profile_id, role, scope_type, scope_id, status, granted_at")
    .in("profile_id", profileIds)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("granted_at", { ascending: false });

  if (rolesError) {
    console.error("[ADMIN_USERS_ROLES] role lookup failed");
    return {
      users: [],
      error: "Unable to load users right now.",
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  const rolesByProfileId = new Map<string, AdminUserRoleSummary[]>();

  for (const roleRow of (roles ?? []) as AdminRoleRow[]) {
    const current = rolesByProfileId.get(roleRow.profile_id) ?? [];
    current.push({
      id: roleRow.id,
      role: roleRow.role,
      scope_type: roleRow.scope_type,
      scope_id: roleRow.scope_id,
      status: roleRow.status,
      assigned_at: roleRow.granted_at,
    });
    rolesByProfileId.set(roleRow.profile_id, current);
  }

  return {
    users: profileRows.map((profile) => ({
      id: profile.id,
      auth_user_id: profile.auth_user_id,
      full_name: profile.full_name,
      display_name: profile.display_name,
      email: profile.email,
      status: profile.status,
      created_at: profile.created_at,
      roles: rolesByProfileId.get(profile.id) ?? [],
    })),
    error: null,
    page: safePage,
    limit: safeLimit,
    hasNext,
  };
}
