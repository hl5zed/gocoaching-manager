import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  ProfileInsert,
  ScopeType,
  SignupRequestRow,
  UserRole,
  UserRoleInsert,
} from "@/types/database";

// Mirrors ROLE_SCOPE_RULES in src/app/api/admin/users/route.ts and
// src/app/admin/users/AdminUserDirectCreatePanel.tsx — this project already
// duplicates this map between client/server rather than sharing a module.
const ROLE_SCOPE_RULES: Partial<Record<UserRole, ScopeType[]>> = {
  country_admin: ["country"],
  organization_admin: ["organization"],
  church_admin: ["church"],
  group_leader: ["group"],
  coach_maker: ["organization", "church", "group"],
  coach: ["organization", "church", "group", "coach"],
  coachee: ["organization", "church", "group"],
};

export type SignupRequestApprovalAffiliation = {
  scopeType?: ScopeType | null;
  scopeId?: string | null;
  countryId?: string | null;
  regionId?: string | null;
  organizationId?: string | null;
  churchId?: string | null;
  groupId?: string | null;
};

type PostgrestErrorLike = {
  code?: string;
  message?: string;
};

export type SignupRequestActionError = {
  status: number;
  code: string;
  message: string;
};

export type SignupRequestActionResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: SignupRequestActionError };

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

async function requireSuperAdmin(): Promise<
  { ok: true } | { ok: false; error: SignupRequestActionError }
> {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return {
      ok: false,
      error: { status: admin.status, code: admin.code, message: admin.message },
    };
  }

  if (!admin.roles.includes("super_admin")) {
    return {
      ok: false,
      error: {
        status: 403,
        code: "SUPER_ADMIN_ROLE_REQUIRED",
        message: "이 작업은 최고 관리자만 수행할 수 있습니다.",
      },
    };
  }

  return { ok: true };
}

function generateTemporaryPassword() {
  return randomBytes(24).toString("base64url");
}

function isDuplicateAuthUserError(error: PostgrestErrorLike | null) {
  return (error?.message ?? "").toLowerCase().includes("already been registered");
}

type SignupRequestsUpdateValues = {
  status: "approved" | "rejected";
  rejected_reason?: string | null;
  reviewed_by: string;
  reviewed_at: string;
  created_profile_id?: string | null;
  updated_at: string;
};

function createSignupRequestsListTable(client: SupabaseClient<Database>) {
  return client.from("signup_requests") as unknown as {
    select: (columns: string) => {
      eq: (
        column: "status",
        value: string,
      ) => {
        is: (
          column: "deleted_at",
          value: null,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<{
            data: SignupRequestRow[] | null;
            error: PostgrestErrorLike | null;
          }>;
        };
      };
    };
  };
}

function createSignupRequestsLookupTable(client: SupabaseClient<Database>) {
  return client.from("signup_requests") as unknown as {
    select: (columns: string) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        is: (
          column: "deleted_at",
          value: null,
        ) => {
          maybeSingle: () => Promise<{
            data: SignupRequestRow | null;
            error: PostgrestErrorLike | null;
          }>;
        };
      };
    };
  };
}

function createSignupRequestsUpdateTable(client: SupabaseClient<Database>) {
  return client.from("signup_requests") as unknown as {
    update: (values: SignupRequestsUpdateValues) => {
      eq: (
        column: "id" | "status",
        value: string,
      ) => {
        eq: (
          column: "id" | "status",
          value: string,
        ) => {
          is: (
            column: "deleted_at",
            value: null,
          ) => {
            select: (columns: string) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: PostgrestErrorLike | null;
              }>;
            };
          };
        };
      };
    };
  };
}

function createProfileLookupTable(client: SupabaseClient<Database>) {
  return client.from("profiles") as unknown as {
    select: (columns: string) => {
      eq: (
        column: "email",
        value: string,
      ) => {
        is: (
          column: "deleted_at",
          value: null,
        ) => {
          maybeSingle: () => Promise<{
            data: { id: string } | null;
            error: PostgrestErrorLike | null;
          }>;
        };
      };
    };
  };
}

function createProfilesTable(client: SupabaseClient<Database>) {
  return client.from("profiles") as unknown as {
    insert: (values: ProfileInsert) => {
      select: (columns: string) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
    delete: () => {
      eq: (column: "id", value: string) => Promise<{ error: PostgrestErrorLike | null }>;
    };
  };
}

function createUserRolesTable(client: SupabaseClient<Database>) {
  return client.from("user_roles") as unknown as {
    insert: (values: UserRoleInsert) => Promise<{ error: PostgrestErrorLike | null }>;
  };
}

export async function getPendingSignupRequests(): Promise<
  SignupRequestActionResult<SignupRequestRow[]>
> {
  const authorized = await requireSuperAdmin();

  if (!authorized.ok) {
    return authorized;
  }

  const { client, error: clientError } = createSupabaseAdminClient();

  if (!client) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "Signup request service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: "지금 가입 신청 목록을 불러올 수 없습니다.",
      },
    };
  }

  const signupRequestsTable = createSignupRequestsListTable(client);
  const { data, error } = await signupRequestsTable
    .select("*")
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    logServerError("SIGNUP_REQUESTS_LIST_FAILED", error.message ?? "");
    return {
      ok: false,
      error: {
        status: 500,
        code: "SIGNUP_REQUESTS_LIST_FAILED",
        message: "지금 가입 신청 목록을 불러올 수 없습니다.",
      },
    };
  }

  return { ok: true, data: data ?? [] };
}

export async function approveSignupRequest({
  signupRequestId,
  affiliation,
}: {
  signupRequestId: string;
  affiliation?: SignupRequestApprovalAffiliation;
}): Promise<SignupRequestActionResult<{ profile_id: string }>> {
  const authorized = await requireSuperAdmin();

  if (!authorized.ok) {
    return authorized;
  }

  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return {
      ok: false,
      error: { status: admin.status, code: admin.code, message: admin.message },
    };
  }

  const { client, error: clientError } = createSupabaseAdminClient();

  if (!client) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "Signup request service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: "지금 가입 신청을 승인할 수 없습니다.",
      },
    };
  }

  const lookupTable = createSignupRequestsLookupTable(client);
  const { data: request, error: lookupError } = await lookupTable
    .select("*")
    .eq("id", signupRequestId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupError) {
    logServerError("SIGNUP_REQUEST_LOOKUP_FAILED", lookupError.message ?? "");
    return {
      ok: false,
      error: {
        status: 500,
        code: "SIGNUP_REQUEST_LOOKUP_FAILED",
        message: "지금 가입 신청을 불러올 수 없습니다.",
      },
    };
  }

  if (!request || request.status !== "pending") {
    return {
      ok: false,
      error: {
        status: 409,
        code: "SIGNUP_REQUEST_NOT_PENDING",
        message: "이미 처리된 가입 신청입니다. 새로고침 후 다시 시도해 주세요.",
      },
    };
  }

  const allowedScopeTypes = ROLE_SCOPE_RULES[request.requested_role] ?? [];
  const effectiveScopeType =
    affiliation?.scopeType ?? request.scope_type;
  const effectiveScopeId = affiliation?.scopeId ?? request.scope_id;

  if (
    allowedScopeTypes.length > 0 &&
    !allowedScopeTypes.includes(effectiveScopeType)
  ) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "SIGNUP_REQUEST_INVALID_SCOPE_TYPE",
        message: "선택한 권한 범위 유형은 이 역할에 허용되지 않습니다.",
      },
    };
  }

  if (effectiveScopeType !== "global" && !effectiveScopeId) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "SIGNUP_REQUEST_SCOPE_ID_REQUIRED",
        message: "선택한 권한 범위에는 범위 대상을 지정해야 합니다.",
      },
    };
  }

  const profileLookupTable = createProfileLookupTable(client);
  const { data: existingProfile, error: existingProfileError } = await profileLookupTable
    .select("id")
    .eq("email", request.email)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingProfileError) {
    logServerError(
      "SIGNUP_REQUEST_PROFILE_LOOKUP_FAILED",
      existingProfileError.message ?? "",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SIGNUP_REQUEST_PROFILE_LOOKUP_FAILED",
        message: "지금 가입 신청을 승인할 수 없습니다.",
      },
    };
  }

  if (existingProfile !== null) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "SIGNUP_REQUEST_EMAIL_ALREADY_REGISTERED",
        message: "이미 등록된 이메일입니다.",
      },
    };
  }

  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email: request.email,
    password: generateTemporaryPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: request.name,
      role: request.requested_role,
    },
  });

  if (authError || !authData.user) {
    logServerError("SIGNUP_REQUEST_AUTH_CREATE_FAILED", authError?.message ?? "");
    return {
      ok: false,
      error: {
        status: isDuplicateAuthUserError(authError) ? 409 : 500,
        code: isDuplicateAuthUserError(authError)
          ? "SIGNUP_REQUEST_EMAIL_ALREADY_REGISTERED"
          : "SIGNUP_REQUEST_AUTH_CREATE_FAILED",
        message: isDuplicateAuthUserError(authError)
          ? "이미 등록된 이메일입니다."
          : "계정 생성 중 오류가 발생했습니다.",
      },
    };
  }

  const authUserId = authData.user.id;
  const profilesTable = createProfilesTable(client);
  const profileInsert: ProfileInsert = {
    auth_user_id: authUserId,
    full_name: request.name,
    display_name: request.name,
    email: request.email,
    primary_role: request.requested_role,
    status: "active",
    preferred_language: request.requested_locale ?? "ko",
    country_id: affiliation?.countryId || null,
    region_id: affiliation?.regionId || null,
    organization_id: affiliation?.organizationId || null,
    church_id: affiliation?.churchId || null,
    group_id: affiliation?.groupId || null,
  };
  const { data: profile, error: profileError } = await profilesTable
    .insert(profileInsert)
    .select("id")
    .single();

  if (profileError || !profile) {
    logServerError("SIGNUP_REQUEST_PROFILE_CREATE_FAILED", profileError?.message ?? "");
    await client.auth.admin.deleteUser(authUserId);
    return {
      ok: false,
      error: {
        status: 500,
        code: "SIGNUP_REQUEST_PROFILE_CREATE_FAILED",
        message: "프로필 생성 중 오류가 발생했습니다.",
      },
    };
  }

  const profileId = profile.id;
  const userRolesTable = createUserRolesTable(client);
  const roleInsert: UserRoleInsert = {
    profile_id: profileId,
    role: request.requested_role,
    scope_type: effectiveScopeType,
    scope_id: effectiveScopeType === "global" ? null : effectiveScopeId,
    granted_by: admin.profile.id,
    status: "active",
    is_active: true,
  };
  const { error: roleError } = await userRolesTable.insert(roleInsert);

  if (roleError) {
    logServerError("SIGNUP_REQUEST_ROLE_CREATE_FAILED", roleError.message ?? "");
    await profilesTable.delete().eq("id", profileId);
    await client.auth.admin.deleteUser(authUserId);
    return {
      ok: false,
      error: {
        status: 500,
        code: "SIGNUP_REQUEST_ROLE_CREATE_FAILED",
        message: "역할 부여 중 오류가 발생했습니다.",
      },
    };
  }

  const now = new Date().toISOString();
  const updateTable = createSignupRequestsUpdateTable(client);
  const { data: updated, error: updateError } = await updateTable
    .update({
      status: "approved",
      reviewed_by: admin.profile.id,
      reviewed_at: now,
      created_profile_id: profileId,
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("status", "pending")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    logServerError(
      "SIGNUP_REQUEST_UPDATE_FAILED",
      updateError?.message ?? "signup request row missing after update",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SIGNUP_REQUEST_UPDATE_FAILED",
        message:
          "가입 신청 상태 갱신 중 오류가 발생했습니다. 계정은 이미 생성되었습니다.",
      },
    };
  }

  return { ok: true, data: { profile_id: profileId } };
}

export async function rejectSignupRequest({
  signupRequestId,
  reason,
}: {
  signupRequestId: string;
  reason: string | null;
}): Promise<SignupRequestActionResult<{ id: string }>> {
  const authorized = await requireSuperAdmin();

  if (!authorized.ok) {
    return authorized;
  }

  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return {
      ok: false,
      error: { status: admin.status, code: admin.code, message: admin.message },
    };
  }

  const { client, error: clientError } = createSupabaseAdminClient();

  if (!client) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "Signup request service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: "지금 가입 신청을 반려할 수 없습니다.",
      },
    };
  }

  const now = new Date().toISOString();
  const updateTable = createSignupRequestsUpdateTable(client);
  const { data, error } = await updateTable
    .update({
      status: "rejected",
      rejected_reason: reason,
      reviewed_by: admin.profile.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", signupRequestId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logServerError("SIGNUP_REQUEST_REJECT_FAILED", error.message ?? "");
    return {
      ok: false,
      error: {
        status: 500,
        code: "SIGNUP_REQUEST_REJECT_FAILED",
        message: "가입 신청 반려 중 오류가 발생했습니다.",
      },
    };
  }

  if (!data) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "SIGNUP_REQUEST_NOT_PENDING",
        message: "이미 처리된 가입 신청입니다. 새로고침 후 다시 시도해 주세요.",
      },
    };
  }

  return { ok: true, data: { id: data.id } };
}
