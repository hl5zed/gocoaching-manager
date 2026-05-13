import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  SCOPE_TYPES,
  USER_ROLES,
  type ProfileInsert,
  type ProfileStatus,
  type ProfileUpdate,
  type ScopeType,
  type UserRole,
  type UserRoleInsert,
  type UserRoleStatus,
} from "@/types/database";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};
const allowedRoles = new Set<UserRole>(USER_ROLES);
const allowedScopes = new Set<ScopeType>(SCOPE_TYPES);

type InsertSingleResult<TData> = Promise<{
  data: TData | null;
  error: { message?: string } | null;
}>;
type ProfilesInsertTable = {
  insert: (values: ProfileInsert) => {
    select: (columns: string) => {
      single: () => InsertSingleResult<{ id: string }>;
    };
  };
  update: (values: ProfileUpdate) => {
    eq: (column: "id", value: string) => Promise<{ error: { message?: string } | null }>;
  };
  delete: () => {
    eq: (column: "id", value: string) => Promise<{ error: { message?: string } | null }>;
  };
};
type UserRolesInsertTable = {
  insert: (values: UserRoleInsert) => Promise<{ error: { message?: string } | null }>;
};
type UserRolesUpdateTable = {
  update: (values: {
    role?: UserRole;
    scope_type?: ScopeType;
    scope_id?: string | null;
    status?: UserRoleStatus;
    is_active?: boolean;
    updated_at?: string;
  }) => {
    eq: (column: "id", value: string) => {
      eq: (column: "profile_id" | "status", value: string) => {
        is: (
          column: "deleted_at",
          value: null,
        ) => Promise<{ error: { message?: string } | null }>;
      };
    };
  };
};
type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>["client"]>;
type ExistingProfileLookup = {
  id: string;
};
type ExistingCountryLookup = {
  id: string;
  is_active: boolean | null;
};
type ExistingOrganizationLookup = {
  id: string;
};
type ExistingLookup = {
  id: string;
};
type ProfileRoleLookup = {
  id: string;
  auth_user_id: string | null;
  primary_role: UserRole | null;
  status: ProfileStatus;
};
type ActiveRoleLookup = {
  id: string;
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
};
type RoleStatusLookup = ActiveRoleLookup & {
  status: UserRoleStatus;
  is_active: boolean;
};
type AuthUserLookupResult = "found" | "not_found" | "failed";

type CreateUserStage =
  | "auth"
  | "validation"
  | "profile"
  | "role"
  | "service";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return normalizeText(value).toLowerCase();
}

function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number) {
  const text = normalizeText(value);

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

function normalizeOptionalUuid(value: FormDataEntryValue | null) {
  const text = normalizeText(value);

  if (text.length === 0) {
    return {
      ok: true as const,
      value: null,
    };
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(text)) {
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

function normalizeOptionalGeneration(value: FormDataEntryValue | null) {
  const text = normalizeText(value);

  if (text.length === 0) {
    return {
      ok: true as const,
      value: null,
    };
  }

  const generationMatch = text.match(/^(\d+)(?:\s*세대)?$/);
  const parsed = generationMatch
    ? Number.parseInt(generationMatch[1] ?? "", 10)
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

async function countryExists(adminClient: AdminClient, countryId: string) {
  const { data, error } = await adminClient
    .from("countries")
    .select("id, is_active")
    .eq("id", countryId)
    .maybeSingle();

  if (error) {
    console.error("[ADMIN_USERS_CREATE_INVALID_COUNTRY]", error.message);
    return {
      ok: false as const,
      exists: false,
    };
  }

  return {
    ok: true as const,
    exists: (data as ExistingCountryLookup | null) !== null,
    isActive: (data as ExistingCountryLookup | null)?.is_active !== false,
  };
}

async function organizationExists(
  adminClient: AdminClient,
  organizationId: string,
) {
  const { data, error } = await adminClient
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[ADMIN_USERS_ORGANIZATION_LOOKUP_FAILED]", error.message);
    return {
      ok: false as const,
      exists: false,
    };
  }

  return {
    ok: true as const,
    exists: (data as ExistingOrganizationLookup | null) !== null,
  };
}

async function lookupExists(
  adminClient: AdminClient,
  table: "churches" | "groups" | "regions",
  id: string,
) {
  let query = adminClient
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (table === "groups") {
    query = adminClient
      .from(table)
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[ADMIN_USERS_${table.toUpperCase()}_LOOKUP_FAILED]`, error.message);
    return {
      ok: false as const,
      exists: false,
    };
  }

  return {
    ok: true as const,
    exists: (data as ExistingLookup | null) !== null,
  };
}

function isProbablyEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function warnCreateValidationFailed(reason: string, intent: string) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.warn("[ADMIN_USERS_CREATE_VALIDATION_FAILED]", {
    intent: intent || "create_profile",
    reason,
  });
}

function getAdminUsersRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/users", request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, {
    status: 303,
    headers: noStoreHeaders,
  });
}

function redirectWithError(
  request: Request,
  stage: CreateUserStage,
  code: string,
) {
  return getAdminUsersRedirect(request, {
    create_error_stage: stage,
    create_error: code,
  });
}

function redirectWithProfileUpdateError(request: Request, code: string) {
  return getAdminUsersRedirectWithMessage(request, {
    profile_error: code,
  });
}

function getRequiredUuid(value: FormDataEntryValue | null) {
  const normalized = normalizeOptionalUuid(value);

  return normalized.ok && normalized.value
    ? {
        ok: true as const,
        value: normalized.value,
      }
    : {
        ok: false as const,
        value: null,
      };
}

function getAdminUsersRedirectWithMessage(
  request: Request,
  params: Record<string, string>,
) {
  return getAdminUsersRedirect(request, params);
}

async function handleRoleAdd({
  request,
  adminClient,
  adminAuthUserId,
  adminProfileId,
  formData,
}: {
  request: Request;
  adminClient: AdminClient;
  adminAuthUserId: string;
  adminProfileId: string;
  formData: FormData;
}) {
  const profileId = normalizeText(formData.get("profile_id"));
  const role = normalizeText(formData.get("role"));
  const scopeType = normalizeText(formData.get("scope_type"));

  if (profileId.length === 0) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "member_not_found",
    });
  }

  if (!allowedRoles.has(role as UserRole)) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "invalid_role",
    });
  }

  if (role === "super_admin") {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "super_admin_protected",
    });
  }

  if (!allowedScopes.has(scopeType as ScopeType)) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "invalid_scope",
    });
  }

  const normalizedScopeId = normalizeOptionalUuid(formData.get("scope_id"));

  if (!normalizedScopeId.ok) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "invalid_scope_id",
    });
  }

  const scopeId = scopeType === "global" ? null : normalizedScopeId.value;

  if (scopeType !== "global" && !scopeId) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "missing_scope_id",
    });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, auth_user_id, primary_role")
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    console.error("[ADMIN_USER_ROLE_ADD_PROFILE_LOOKUP_FAILED]", profileError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "profile_lookup_failed",
    });
  }

  const profileRow = profile as ProfileRoleLookup | null;

  if (!profileRow) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "member_not_found",
    });
  }

  if (profileRow.id === adminProfileId || profileRow.auth_user_id === adminAuthUserId) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "self_role_change",
    });
  }

  if (profileRow.primary_role === "super_admin") {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "super_admin_protected",
    });
  }

  const { data: existingRole, error: existingRoleError } = await adminClient
    .from("user_roles")
    .select("id")
    .eq("profile_id", profileId)
    .eq("role", role)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existingRoleError) {
    console.error("[ADMIN_USER_ROLE_ADD_LOOKUP_FAILED]", existingRoleError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_lookup_failed",
    });
  }

  if (existingRole) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "duplicate_role",
    });
  }

  const roleInsert: UserRoleInsert = {
    profile_id: profileId,
    role: role as UserRole,
    scope_type: scopeType as ScopeType,
    scope_id: scopeId,
    granted_by: adminProfileId,
    status: "active",
    is_active: true,
  };
  const userRolesTable = adminClient.from("user_roles") as unknown as UserRolesInsertTable;
  const { error: roleInsertError } = await userRolesTable.insert(roleInsert);

  if (roleInsertError) {
    console.error("[ADMIN_USER_ROLE_ADD_FAILED]", roleInsertError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_add_failed",
    });
  }

  return getAdminUsersRedirectWithMessage(request, {
    role_added: "1",
  });
}

async function handleRoleUpdate({
  request,
  adminClient,
  adminAuthUserId,
  adminProfileId,
  formData,
}: {
  request: Request;
  adminClient: AdminClient;
  adminAuthUserId: string;
  adminProfileId: string;
  formData: FormData;
}) {
  const profileId = normalizeText(formData.get("profile_id"));
  const roleId = normalizeText(formData.get("role_id"));
  const role = normalizeText(formData.get("role"));

  if (profileId.length === 0 || roleId.length === 0) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "member_not_found",
    });
  }

  if (!allowedRoles.has(role as UserRole)) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "invalid_role",
    });
  }

  if (role === "super_admin") {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "super_admin_protected",
    });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, auth_user_id, primary_role")
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    console.error("[ADMIN_USER_ROLE_PROFILE_LOOKUP_FAILED]", profileError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "profile_lookup_failed",
    });
  }

  const profileRow = profile as ProfileRoleLookup | null;

  if (!profileRow) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "member_not_found",
    });
  }

  if (profileRow.id === adminProfileId || profileRow.auth_user_id === adminAuthUserId) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "self_role_change",
    });
  }

  const { data: activeRoles, error: activeRolesError } = await adminClient
    .from("user_roles")
    .select("id, role, scope_type, scope_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("granted_at", { ascending: false });

  if (activeRolesError) {
    console.error("[ADMIN_USER_ROLE_LOOKUP_FAILED]", activeRolesError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_lookup_failed",
    });
  }

  const currentRole = ((activeRoles ?? []) as ActiveRoleLookup[]).find(
    (roleRow) => roleRow.id === roleId,
  );

  if (!currentRole) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_not_found",
    });
  }

  if (profileRow.primary_role === "super_admin" || currentRole?.role === "super_admin") {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "super_admin_protected",
    });
  }

  const existingScopeType = currentRole?.scope_type ?? "global";
  const existingScopeId = existingScopeType === "global" ? null : currentRole?.scope_id ?? null;
  const profilesTable = adminClient.from("profiles") as unknown as ProfilesInsertTable;
  const userRolesUpdateTable = adminClient.from("user_roles") as unknown as UserRolesUpdateTable;
  const { error: profileUpdateError } = await profilesTable
    .update({ primary_role: role as UserRole })
    .eq("id", profileId);

  if (profileUpdateError) {
    console.error("[ADMIN_USER_ROLE_PROFILE_UPDATE_FAILED]", profileUpdateError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_update_failed",
    });
  }

  const { error: roleUpdateError } = await userRolesUpdateTable
    .update({
      role: role as UserRole,
      scope_type: existingScopeType,
      scope_id: existingScopeId,
    })
    .eq("id", roleId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (roleUpdateError) {
    console.error("[ADMIN_USER_ROLE_UPDATE_FAILED]", roleUpdateError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_update_failed",
    });
  }

  return getAdminUsersRedirectWithMessage(request, {
    role_updated: "1",
  });
}

async function handleRoleStatusUpdate({
  request,
  adminClient,
  adminAuthUserId,
  adminProfileId,
  formData,
}: {
  request: Request;
  adminClient: AdminClient;
  adminAuthUserId: string;
  adminProfileId: string;
  formData: FormData;
}) {
  const profileId = normalizeText(formData.get("profile_id"));
  const roleId = normalizeText(formData.get("role_id"));
  const targetStatus = normalizeText(formData.get("target_role_status"));

  if (profileId.length === 0 || roleId.length === 0) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "member_not_found",
    });
  }

  if (targetStatus !== "active" && targetStatus !== "inactive") {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "invalid_status",
    });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, auth_user_id, primary_role")
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    console.error("[ADMIN_USER_ROLE_STATUS_PROFILE_LOOKUP_FAILED]", profileError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "profile_lookup_failed",
    });
  }

  const profileRow = profile as ProfileRoleLookup | null;

  if (!profileRow) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "member_not_found",
    });
  }

  if (profileRow.id === adminProfileId || profileRow.auth_user_id === adminAuthUserId) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "self_role_change",
    });
  }

  const { data: roleRow, error: roleLookupError } = await adminClient
    .from("user_roles")
    .select("id, role, scope_type, scope_id, status, is_active")
    .eq("id", roleId)
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (roleLookupError) {
    console.error("[ADMIN_USER_ROLE_STATUS_LOOKUP_FAILED]", roleLookupError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_lookup_failed",
    });
  }

  const currentRole = roleRow as RoleStatusLookup | null;

  if (!currentRole) {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_not_found",
    });
  }

  if (profileRow.primary_role === "super_admin" || currentRole.role === "super_admin") {
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "super_admin_protected",
    });
  }

  const userRolesUpdateTable = adminClient.from("user_roles") as unknown as UserRolesUpdateTable;
  const { error: updateError } = await userRolesUpdateTable
    .update({
      status: targetStatus as UserRoleStatus,
      is_active: targetStatus === "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", roleId)
    .eq("profile_id", profileId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("[ADMIN_USER_ROLE_STATUS_UPDATE_FAILED]", updateError.message);
    return getAdminUsersRedirectWithMessage(request, {
      role_error: "role_status_update_failed",
    });
  }

  return getAdminUsersRedirectWithMessage(request, {
    role_status_updated: targetStatus,
  });
}

async function handleStatusUpdate({
  request,
  adminClient,
  adminAuthUserId,
  adminProfileId,
  formData,
}: {
  request: Request;
  adminClient: AdminClient;
  adminAuthUserId: string;
  adminProfileId: string;
  formData: FormData;
}) {
  const profileId = normalizeText(formData.get("profile_id"));
  const targetStatus = normalizeText(formData.get("target_status"));

  if (profileId.length === 0) {
    return getAdminUsersRedirectWithMessage(request, {
      status_error: "member_not_found",
    });
  }

  if (targetStatus !== "active" && targetStatus !== "inactive") {
    return getAdminUsersRedirectWithMessage(request, {
      status_error: "invalid_status",
    });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, auth_user_id, primary_role, status")
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    console.error("[ADMIN_USER_STATUS_PROFILE_LOOKUP_FAILED]", profileError.message);
    return getAdminUsersRedirectWithMessage(request, {
      status_error: "profile_lookup_failed",
    });
  }

  const profileRow = profile as ProfileRoleLookup | null;

  if (!profileRow) {
    return getAdminUsersRedirectWithMessage(request, {
      status_error: "member_not_found",
    });
  }

  if (
    targetStatus === "inactive" &&
    (profileRow.id === adminProfileId || profileRow.auth_user_id === adminAuthUserId)
  ) {
    return getAdminUsersRedirectWithMessage(request, {
      status_error: "self_disable",
    });
  }

  const { data: activeRoles, error: activeRolesError } = await adminClient
    .from("user_roles")
    .select("id, role, scope_type, scope_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (activeRolesError) {
    console.error("[ADMIN_USER_STATUS_ROLE_LOOKUP_FAILED]", activeRolesError.message);
    return getAdminUsersRedirectWithMessage(request, {
      status_error: "role_lookup_failed",
    });
  }

  const hasSuperAdminRole =
    profileRow.primary_role === "super_admin" ||
    ((activeRoles ?? []) as ActiveRoleLookup[]).some(
      (roleRow) => roleRow.role === "super_admin",
    );

  if (hasSuperAdminRole) {
    return getAdminUsersRedirectWithMessage(request, {
      status_error: "super_admin_protected",
    });
  }

  const profilesTable = adminClient.from("profiles") as unknown as ProfilesInsertTable;
  const { error: updateError } = await profilesTable
    .update({ status: targetStatus as ProfileStatus })
    .eq("id", profileId);

  if (updateError) {
    console.error("[ADMIN_USER_STATUS_UPDATE_FAILED]", updateError.message);
    return getAdminUsersRedirectWithMessage(request, {
      status_error:
        targetStatus === "inactive" ? "disable_failed" : "reactivate_failed",
    });
  }

  return getAdminUsersRedirectWithMessage(request, {
    status_updated: targetStatus,
  });
}

async function handleProfileUpdate({
  request,
  adminClient,
  adminRoles,
  formData,
}: {
  request: Request;
  adminClient: AdminClient;
  adminRoles: UserRole[];
  formData: FormData;
}) {
  if (!adminRoles.includes("super_admin")) {
    return redirectWithProfileUpdateError(request, "permission_denied");
  }

  const profileId = getRequiredUuid(formData.get("profile_id"));

  if (!profileId.ok) {
    return redirectWithProfileUpdateError(request, "member_not_found");
  }

  const fullName = normalizeText(formData.get("full_name"));
  const displayName = normalizeOptionalText(formData.get("display_name"), 120);
  const phone = normalizeOptionalText(formData.get("phone"), 40);
  const countryId = normalizeOptionalUuid(formData.get("country_id"));
  const regionId = normalizeOptionalUuid(formData.get("region_id"));
  const organizationId = normalizeOptionalUuid(formData.get("organization_id"));
  const churchId = normalizeOptionalUuid(formData.get("church_id"));
  const groupId = normalizeOptionalUuid(formData.get("group_id"));
  const ministryPosition = normalizeOptionalText(
    formData.get("ministry_position"),
    100,
  );
  const generationNumber = normalizeOptionalGeneration(
    formData.get("generation_number"),
  );
  const status = normalizeText(formData.get("status"));

  if (fullName.length === 0 || fullName.length > 120) {
    return redirectWithProfileUpdateError(request, "invalid_name");
  }

  if (!displayName.ok) {
    return redirectWithProfileUpdateError(request, "invalid_display_name");
  }

  if (!phone.ok) {
    return redirectWithProfileUpdateError(request, "invalid_phone");
  }

  if (!countryId.ok) {
    return redirectWithProfileUpdateError(request, "invalid_country");
  }

  if (!regionId.ok) {
    return redirectWithProfileUpdateError(request, "invalid_region");
  }

  if (!organizationId.ok) {
    return redirectWithProfileUpdateError(request, "invalid_organization");
  }

  if (!churchId.ok) {
    return redirectWithProfileUpdateError(request, "invalid_church");
  }

  if (!groupId.ok) {
    return redirectWithProfileUpdateError(request, "invalid_group");
  }

  if (!ministryPosition.ok) {
    return redirectWithProfileUpdateError(request, "invalid_ministry_position");
  }

  if (!generationNumber.ok) {
    return redirectWithProfileUpdateError(request, "invalid_generation");
  }

  if (
    status !== "active" &&
    status !== "inactive" &&
    status !== "suspended" &&
    status !== "archived" &&
    status !== "anonymized"
  ) {
    return redirectWithProfileUpdateError(request, "invalid_status");
  }

  if (countryId.value) {
    const countryLookup = await countryExists(adminClient, countryId.value);

    if (!countryLookup.ok) {
      return redirectWithProfileUpdateError(request, "country_lookup_failed");
    }

    if (!countryLookup.exists) {
      return redirectWithProfileUpdateError(request, "country_not_found");
    }

    if (!countryLookup.isActive) {
      return redirectWithProfileUpdateError(request, "country_inactive");
    }
  }

  if (organizationId.value) {
    const organizationLookup = await organizationExists(
      adminClient,
      organizationId.value,
    );

    if (!organizationLookup.ok) {
      return redirectWithProfileUpdateError(request, "organization_lookup_failed");
    }

    if (!organizationLookup.exists) {
      return redirectWithProfileUpdateError(request, "organization_not_found");
    }
  }

  if (regionId.value) {
    const regionLookup = await lookupExists(adminClient, "regions", regionId.value);

    if (!regionLookup.ok) {
      return redirectWithProfileUpdateError(request, "region_lookup_failed");
    }

    if (!regionLookup.exists) {
      return redirectWithProfileUpdateError(request, "region_not_found");
    }
  }

  if (churchId.value) {
    const churchLookup = await lookupExists(adminClient, "churches", churchId.value);

    if (!churchLookup.ok) {
      return redirectWithProfileUpdateError(request, "church_lookup_failed");
    }

    if (!churchLookup.exists) {
      return redirectWithProfileUpdateError(request, "church_not_found");
    }
  }

  if (groupId.value) {
    const groupLookup = await lookupExists(adminClient, "groups", groupId.value);

    if (!groupLookup.ok) {
      return redirectWithProfileUpdateError(request, "group_lookup_failed");
    }

    if (!groupLookup.exists) {
      return redirectWithProfileUpdateError(request, "group_not_found");
    }
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", profileId.value)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    console.error("[ADMIN_USER_PROFILE_UPDATE_LOOKUP_FAILED]", profileError.message);
    return redirectWithProfileUpdateError(request, "profile_lookup_failed");
  }

  if (!profile) {
    return redirectWithProfileUpdateError(request, "member_not_found");
  }

  const profilesTable = adminClient.from("profiles") as unknown as ProfilesInsertTable;
  const updatePayload: ProfileUpdate = {
    full_name: fullName,
    display_name: displayName.value,
    phone: phone.value,
    country_id: countryId.value,
    region_id: regionId.value,
    organization_id: organizationId.value,
    church_id: churchId.value,
    group_id: groupId.value,
    ministry_position: ministryPosition.value,
    generation_number: generationNumber.value,
    status: status as ProfileStatus,
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await profilesTable
    .update(updatePayload)
    .eq("id", profileId.value);

  if (updateError) {
    console.error("[ADMIN_USER_PROFILE_UPDATE_FAILED]", updateError.message);
    return redirectWithProfileUpdateError(request, "update_failed");
  }

  return getAdminUsersRedirectWithMessage(request, {
    profile_updated: "1",
  });
}

function isDuplicateAuthUserError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";

  return (
    message.includes("already") ||
    message.includes("exist") ||
    message.includes("registered")
  );
}

function normalizeAuthEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

async function findAuthUserByEmail(
  adminClient: AdminClient,
  email: string,
): Promise<AuthUserLookupResult> {
  const perPage = 1000;
  const maxPages = 50;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("[ADMIN_DIRECT_USER_CREATE_AUTH_LOOKUP_FAILED]", error.message);
      return "failed";
    }

    const users = data.users;
    const matchingUser = users.find(
      (user) => normalizeAuthEmail(user.email) === email,
    );

    if (matchingUser) {
      return "found";
    }

    if (users.length < perPage) {
      return "not_found";
    }
  }

  console.error("[ADMIN_DIRECT_USER_CREATE_AUTH_LOOKUP_LIMIT_REACHED]");
  return "failed";
}

function formDataFromProfilePatch(input: unknown) {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const formData = new FormData();
  const fieldMap: Record<string, string> = {
    profileId: "profile_id",
    profile_id: "profile_id",
    full_name: "full_name",
    display_name: "display_name",
    phone: "phone",
    country_id: "country_id",
    region_id: "region_id",
    organization_id: "organization_id",
    church_id: "church_id",
    group_id: "group_id",
    ministry_position: "ministry_position",
    generation_number: "generation_number",
    status: "status",
  };

  for (const [inputKey, formKey] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(source, inputKey)) {
      const value = source[inputKey];
      formData.set(formKey, value === null || value === undefined ? "" : String(value));
    }
  }

  return formData;
}

function profilePatchJsonResponseFromRedirect(response: NextResponse) {
  const location = response.headers.get("location");
  const url = location ? new URL(location) : null;
  const error = url?.searchParams.get("profile_error");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error,
      },
      {
        status: error === "permission_denied" ? 403 : 400,
        headers: noStoreHeaders,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "회원 정보가 수정되었습니다.",
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      {
        status: admin.status,
        headers: noStoreHeaders,
      },
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return redirectWithError(request, "validation", "invalid_body");
  }

  const fullName = normalizeText(formData.get("full_name"));
  const intent = normalizeText(formData.get("intent"));
  const email = normalizeEmail(formData.get("email"));
  const role = normalizeText(formData.get("role"));
  const scopeType = normalizeText(formData.get("scope_type"));
  const temporaryPassword = normalizeText(formData.get("temporary_password"));

  const { client: adminClient, error: adminClientError } =
    createSupabaseAdminClient();

  if (!adminClient) {
    console.error("[ADMIN_DIRECT_USER_CREATE_SERVICE_UNAVAILABLE]", adminClientError);
    return redirectWithError(request, "service", "service_unavailable");
  }

  const typedAdminClient = adminClient as AdminClient;

  if (intent === "update_role") {
    return handleRoleUpdate({
      request,
      adminClient: typedAdminClient,
      adminAuthUserId: admin.authUserId,
      adminProfileId: admin.profile.id,
      formData,
    });
  }

  if (intent === "update_role_status") {
    return handleRoleStatusUpdate({
      request,
      adminClient: typedAdminClient,
      adminAuthUserId: admin.authUserId,
      adminProfileId: admin.profile.id,
      formData,
    });
  }

  if (intent === "add_role") {
    return handleRoleAdd({
      request,
      adminClient: typedAdminClient,
      adminAuthUserId: admin.authUserId,
      adminProfileId: admin.profile.id,
      formData,
    });
  }

  if (intent === "update_status") {
    return handleStatusUpdate({
      request,
      adminClient: typedAdminClient,
      adminAuthUserId: admin.authUserId,
      adminProfileId: admin.profile.id,
      formData,
    });
  }

  if (intent === "update_profile") {
    return handleProfileUpdate({
      request,
      adminClient: typedAdminClient,
      adminRoles: admin.roles,
      formData,
    });
  }

  if (intent.length > 0 && intent !== "create_profile") {
    return redirectWithError(request, "validation", "invalid_intent");
  }

  if (fullName.length === 0 || fullName.length > 120) {
    warnCreateValidationFailed("invalid_full_name", intent);
    return redirectWithError(request, "validation", "invalid_name");
  }

  if (!isProbablyEmail(email)) {
    warnCreateValidationFailed("invalid_email", intent);
    return redirectWithError(request, "validation", "invalid_email");
  }

  if (!allowedRoles.has(role as UserRole)) {
    warnCreateValidationFailed("invalid_role", intent);
    return redirectWithError(request, "validation", "invalid_role");
  }

  if (role === "super_admin") {
    return redirectWithError(request, "validation", "super_admin_protected");
  }

  if (!allowedScopes.has(scopeType as ScopeType)) {
    console.error("[ADMIN_USERS_CREATE_INVALID_SCOPE] invalid scope_type", scopeType);
    return redirectWithError(request, "validation", "invalid_scope");
  }

  const normalizedScopeId = normalizeOptionalUuid(formData.get("scope_id"));

  if (!normalizedScopeId.ok) {
    console.error("[ADMIN_USERS_CREATE_INVALID_SCOPE] invalid scope_id");
    return redirectWithError(request, "validation", "invalid_scope_id");
  }

  const scopeId: string | null =
    scopeType === "global" ? null : normalizedScopeId.value;

  if (scopeType !== "global" && !scopeId) {
    console.error("[ADMIN_USERS_CREATE_INVALID_SCOPE] missing scope_id", scopeType);
    return redirectWithError(request, "validation", "missing_scope_id");
  }

  if (temporaryPassword.length < 8 || temporaryPassword.length > 72) {
    warnCreateValidationFailed("invalid_temporary_password", intent);
    return redirectWithError(request, "validation", "invalid_password");
  }

  const countryId = normalizeOptionalUuid(formData.get("country_id"));
  const regionId = normalizeOptionalUuid(formData.get("region_id"));
  const organizationId = normalizeOptionalUuid(formData.get("organization_id"));
  const churchId = normalizeOptionalUuid(formData.get("church_id"));
  const groupId = normalizeOptionalUuid(formData.get("group_id"));
  const ministryPosition = normalizeOptionalText(
    formData.get("ministry_position"),
    100,
  );
  const generationNumber = normalizeOptionalGeneration(
    formData.get("generation_number"),
  );

  if (!countryId.ok) {
    console.error("[ADMIN_USERS_CREATE_INVALID_COUNTRY] invalid country_id");
    return redirectWithError(request, "validation", "invalid_country");
  }

  if (!regionId.ok) {
    warnCreateValidationFailed("invalid_region_id", intent);
    return redirectWithError(request, "validation", "invalid_region");
  }

  if (!organizationId.ok) {
    warnCreateValidationFailed("invalid_organization_id", intent);
    return redirectWithError(request, "validation", "invalid_organization");
  }

  if (!churchId.ok) {
    warnCreateValidationFailed("invalid_church_id", intent);
    return redirectWithError(request, "validation", "invalid_church");
  }

  if (!groupId.ok) {
    warnCreateValidationFailed("invalid_group_id", intent);
    return redirectWithError(request, "validation", "invalid_group");
  }

  if (!ministryPosition.ok) {
    warnCreateValidationFailed("invalid_ministry_position", intent);
    return redirectWithError(request, "validation", "invalid_ministry_position");
  }

  if (!generationNumber.ok) {
    console.error("[ADMIN_USERS_CREATE_INVALID_GENERATION]");
    return redirectWithError(request, "validation", "invalid_generation");
  }

  if (countryId.value) {
    const countryLookup = await countryExists(typedAdminClient, countryId.value);

    if (!countryLookup.ok) {
      return redirectWithError(request, "validation", "country_lookup_failed");
    }

    if (!countryLookup.exists) {
      console.error("[ADMIN_USERS_CREATE_INVALID_COUNTRY] country not found");
      return redirectWithError(request, "validation", "country_not_found");
    }

    if (!countryLookup.isActive) {
      console.error("[ADMIN_USERS_CREATE_INVALID_COUNTRY] inactive country");
      return redirectWithError(request, "validation", "country_inactive");
    }
  }

  if (organizationId.value) {
    const organizationLookup = await organizationExists(
      typedAdminClient,
      organizationId.value,
    );

    if (!organizationLookup.ok) {
      return redirectWithError(request, "validation", "organization_lookup_failed");
    }

    if (!organizationLookup.exists) {
      console.error("[ADMIN_USERS_CREATE_INVALID_ORGANIZATION] organization not found");
      return redirectWithError(request, "validation", "organization_not_found");
    }
  }

  if (regionId.value) {
    const regionLookup = await lookupExists(typedAdminClient, "regions", regionId.value);

    if (!regionLookup.ok) {
      return redirectWithError(request, "validation", "region_lookup_failed");
    }

    if (!regionLookup.exists) {
      console.error("[ADMIN_USERS_CREATE_INVALID_REGION] region not found");
      return redirectWithError(request, "validation", "region_not_found");
    }
  }

  if (churchId.value) {
    const churchLookup = await lookupExists(typedAdminClient, "churches", churchId.value);

    if (!churchLookup.ok) {
      return redirectWithError(request, "validation", "church_lookup_failed");
    }

    if (!churchLookup.exists) {
      console.error("[ADMIN_USERS_CREATE_INVALID_CHURCH] church not found");
      return redirectWithError(request, "validation", "church_not_found");
    }
  }

  if (groupId.value) {
    const groupLookup = await lookupExists(typedAdminClient, "groups", groupId.value);

    if (!groupLookup.ok) {
      return redirectWithError(request, "validation", "group_lookup_failed");
    }

    if (!groupLookup.exists) {
      console.error("[ADMIN_USERS_CREATE_INVALID_GROUP] group not found");
      return redirectWithError(request, "validation", "group_not_found");
    }
  }

  const { data: existingProfile, error: existingProfileError } =
    await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

  if (existingProfileError) {
    console.error(
      "[ADMIN_DIRECT_USER_CREATE_PROFILE_LOOKUP_FAILED]",
      existingProfileError.message,
    );
    return redirectWithError(request, "profile", "profile_lookup_failed");
  }

  if ((existingProfile as ExistingProfileLookup | null) !== null) {
    console.error("[ADMIN_USERS_CREATE_DUPLICATE_EMAIL] profile email already exists");
    return redirectWithError(request, "profile", "registered_profile");
  }

  const authUserLookup = await findAuthUserByEmail(typedAdminClient, email);

  if (authUserLookup === "failed") {
    return redirectWithError(request, "auth", "auth_lookup_failed");
  }

  if (authUserLookup === "found") {
    console.error("[ADMIN_USERS_CREATE_DUPLICATE_EMAIL] auth user already exists");
    return redirectWithError(request, "auth", "auth_without_profile");
  }

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

  if (authError || !authData.user) {
    console.error("[ADMIN_DIRECT_USER_CREATE_AUTH_FAILED]", authError?.message);
    if (isDuplicateAuthUserError(authError)) {
      return redirectWithError(request, "auth", "auth_without_profile");
    }

    return redirectWithError(request, "auth", "auth_create_failed");
  }

  const authUserId = authData.user.id;
  const profileInsert: ProfileInsert = {
    auth_user_id: authUserId,
    full_name: fullName,
    display_name: fullName,
    email,
    country_id: countryId.value,
    region_id: regionId.value,
    organization_id: organizationId.value,
    church_id: churchId.value,
    group_id: groupId.value,
    ministry_position: ministryPosition.value,
    generation_number: generationNumber.value,
    primary_role: role as UserRole,
    status: "active",
    preferred_language: "ko",
  };
  const profilesTable = typedAdminClient.from("profiles") as unknown as ProfilesInsertTable;
  const { data: profile, error: profileError } = await profilesTable
    .insert(profileInsert)
    .select("id")
    .single();

  if (profileError || !profile) {
    console.error("[ADMIN_DIRECT_USER_CREATE_PROFILE_FAILED]", profileError?.message);
    await adminClient.auth.admin.deleteUser(authUserId);
    return redirectWithError(request, "profile", "profile_create_failed");
  }

  const profileId = (profile as { id: string }).id;
  const roleInsert: UserRoleInsert = {
    profile_id: profileId,
    role: role as UserRole,
    scope_type: scopeType as ScopeType,
    scope_id: scopeId,
    granted_by: admin.profile.id,
    status: "active",
    is_active: true,
  };
  const userRolesTable = typedAdminClient.from("user_roles") as unknown as UserRolesInsertTable;
  const { error: roleError } = await userRolesTable.insert(roleInsert);

  if (roleError) {
    console.error("[ADMIN_DIRECT_USER_CREATE_ROLE_FAILED]", roleError.message);
    await profilesTable.delete().eq("id", profileId);
    await adminClient.auth.admin.deleteUser(authUserId);
    return redirectWithError(request, "role", "role_create_failed");
  }

  return getAdminUsersRedirect(request, {
    created: "1",
    created_email: email,
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return NextResponse.json(
      { ok: false, error: "관리자 권한이 필요합니다." },
      {
        status: admin.status,
        headers: noStoreHeaders,
      },
    );
  }

  const { client: adminClient, error: adminClientError } =
    createSupabaseAdminClient();

  if (!adminClient) {
    console.error("[ADMIN_USER_PROFILE_PATCH_SERVICE_UNAVAILABLE]", adminClientError);
    return NextResponse.json(
      { ok: false, error: "관리자 서비스 준비에 실패했습니다." },
      {
        status: 500,
        headers: noStoreHeaders,
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문을 확인해 주세요." },
      {
        status: 400,
        headers: noStoreHeaders,
      },
    );
  }

  const redirectResponse = await handleProfileUpdate({
    request,
    adminClient: adminClient as AdminClient,
    adminRoles: admin.roles,
    formData: formDataFromProfilePatch(body),
  });

  return profilePatchJsonResponseFromRedirect(redirectResponse);
}
