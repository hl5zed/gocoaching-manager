import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  sendInvitationEmail,
  type SendInvitationEmailResult,
} from "@/lib/email/send-invitation-email";
import {
  SCOPE_TYPES,
  USER_ROLES,
  type InvitationRow,
  type Database,
  type InvitationInsert,
  type InvitationStatus,
  type ScopeType,
  type UserRole,
} from "@/types/database";

const allowedRoles = new Set<UserRole>(USER_ROLES);
const allowedScopes = new Set<ScopeType>(SCOPE_TYPES);

type CreateInvitationInput = {
  email?: unknown;
  invited_role?: unknown;
  organization_id?: unknown;
  scope_type?: unknown;
  scope_id?: unknown;
  expires_in_days?: unknown;
  send_email?: unknown;
};

type ExistingPendingInvitation = {
  id: string;
};

type CreatedInvitationRow = Pick<
  InvitationRow,
  | "id"
  | "invited_email"
  | "invited_role"
  | "scope_type"
  | "scope_id"
  | "expires_at"
  | "status"
>;

type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

type OrganizationValidationRow = {
  id: string;
  is_active: boolean | null;
  deleted_at: string | null;
};

type OrganizationValidationTable = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      maybeSingle: () => Promise<{
        data: OrganizationValidationRow | null;
        error: PostgrestErrorLike | null;
      }>;
    };
  };
};

export type CreateInvitationSuccess = {
  invitation_id: string;
  email: string;
  invited_role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  expires_at: string;
  status: InvitationStatus;
  invitationUrl: string;
  emailDelivery?: SendInvitationEmailResult extends infer TResult
    ? TResult extends { ok: true }
      ? { sent: true }
      : TResult extends { ok: false; code: infer TCode extends string }
        ? {
            sent: false;
            code: TCode;
            message: string;
          }
        : never
    : never;
};

export type CreateInvitationError = {
  status: number;
  code: string;
  message: string;
};

export type CreateInvitationResult =
  | {
      ok: true;
      data: CreateInvitationSuccess;
    }
  | {
      ok: false;
      error: CreateInvitationError;
    };

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

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeScopeId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeExpiresInDays(value: unknown) {
  if (value === undefined || value === null || value === "") {
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

function normalizeSendEmail(value: unknown) {
  return value === true;
}

function isProbablyEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createTokenPair() {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  return { rawToken, tokenHash };
}

function createExpiresAt(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function getAppOrigin(requestOrigin: string) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    requestOrigin;

  return configuredOrigin.replace(/\/+$/, "");
}

function createInvitationUrl(origin: string, rawToken: string) {
  return `${origin}/invitations/accept?token=${encodeURIComponent(rawToken)}`;
}

function isPendingInvitationUniqueError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const postgrestError = error as PostgrestErrorLike;
  const errorText = `${postgrestError.message ?? ""} ${
    postgrestError.details ?? ""
  }`;

  return (
    postgrestError.code === "23505" &&
    (errorText.includes("uq_invitations_pending_global") ||
      errorText.includes("uq_invitations_pending_scoped"))
  );
}

async function findExistingPendingInvitation(
  supabase: SupabaseClient<Database>,
  email: string,
  invitedRole: UserRole,
  scopeType: ScopeType,
  scopeId: string | null,
) {
  let query = supabase
    .from("invitations")
    .select("id")
    .eq("invited_email", email)
    .eq("invited_role", invitedRole)
    .eq("scope_type", scopeType)
    .eq("status", "pending")
    .is("deleted_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  query = scopeId === null ? query.is("scope_id", null) : query.eq("scope_id", scopeId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    return {
      invitation: null,
      error,
    };
  }

  return {
    invitation: (data as ExistingPendingInvitation | null) ?? null,
    error: null,
  };
}

export async function createAdminInvitation({
  input,
  requestOrigin,
}: {
  input: CreateInvitationInput;
  requestOrigin: string;
}): Promise<CreateInvitationResult> {
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

  const email = normalizeEmail(input.email);
  const invitedRole =
    typeof input.invited_role === "string" ? input.invited_role : "";
  const scopeType = typeof input.scope_type === "string" ? input.scope_type : "";
  const rawScopeId = normalizeScopeId(input.scope_id);
  const organizationId = normalizeScopeId(input.organization_id);
  const expiresInDays = normalizeExpiresInDays(input.expires_in_days);
  const sendEmail = normalizeSendEmail(input.send_email);
  const isOrganizationDefaultRoleSuggestion = organizationId !== null;
  const effectiveInvitedRole = isOrganizationDefaultRoleSuggestion
    ? "coachee"
    : invitedRole;
  const effectiveScopeType = isOrganizationDefaultRoleSuggestion
    ? "organization"
    : scopeType;
  const effectiveRawScopeId = isOrganizationDefaultRoleSuggestion
    ? organizationId
    : rawScopeId;

  if (!isProbablyEmail(email)) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_EMAIL",
        message: "올바른 이메일 주소를 입력해 주세요.",
      },
    };
  }

  if (
    isOrganizationDefaultRoleSuggestion &&
    invitedRole !== "" &&
    invitedRole !== "coachee"
  ) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_ORGANIZATION_DEFAULT_ROLE",
        message: "조직 기본 권한 초대는 코치이 역할만 허용됩니다.",
      },
    };
  }

  if (!allowedRoles.has(effectiveInvitedRole as UserRole)) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_ROLE",
        message: "초대 역할이 올바르지 않습니다.",
      },
    };
  }

  if (!allowedScopes.has(effectiveScopeType as ScopeType)) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_SCOPE_TYPE",
        message: "범위 유형이 올바르지 않습니다.",
      },
    };
  }

  const normalizedScopeId =
    effectiveScopeType === "global" ? null : effectiveRawScopeId;

  if (effectiveScopeType === "global" && effectiveRawScopeId !== null) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_SCOPE_ID",
        message: "전체 범위 초대에는 범위 ID를 넣을 수 없습니다.",
      },
    };
  }

  if (effectiveScopeType !== "global" && normalizedScopeId === null) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "MISSING_SCOPE_ID",
        message: "이 범위 유형에는 범위 ID가 필요합니다.",
      },
    };
  }

  if (
    isOrganizationDefaultRoleSuggestion &&
    (!organizationId || !isUuid(organizationId))
  ) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_ORGANIZATION_ID",
        message: "조직 기본 권한 초대에는 올바른 조직 ID가 필요합니다.",
      },
    };
  }

  if (expiresInDays === null) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_EXPIRATION",
        message: "만료 기간은 1일에서 30일 사이여야 합니다.",
      },
    };
  }

  const scopeAccess = await assertAdminInvitationScopeAccess(
    admin.supabase,
    admin.profile.id,
    admin.roles,
    {
      scope_type: effectiveScopeType as ScopeType,
      scope_id: normalizedScopeId,
    },
  );

  if (!scopeAccess.ok) {
    return {
      ok: false,
      error: scopeAccess.error,
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Invitation service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: "초대 서비스를 지금 사용할 수 없습니다.",
      },
    };
  }

  if (isOrganizationDefaultRoleSuggestion) {
    const organizationsTable = serviceClient.from(
      "organizations",
    ) as unknown as OrganizationValidationTable;
    const { data: organization, error: organizationError } = await organizationsTable
      .select("id,is_active,deleted_at")
      .eq("id", organizationId)
      .maybeSingle();

    if (organizationError) {
      logServerError(
        "ORGANIZATION_LOOKUP_FAILED",
        organizationError.message ?? "Organization lookup failed.",
      );
      return {
        ok: false,
        error: {
          status: 500,
          code: "ORGANIZATION_LOOKUP_FAILED",
          message: "조직을 확인하지 못했습니다.",
        },
      };
    }

    if (
      !organization ||
      organization.is_active !== true ||
      organization.deleted_at !== null
    ) {
      return {
        ok: false,
        error: {
          status: 400,
          code: "INVALID_ORGANIZATION",
          message: "활성 조직에만 기본 권한 초대를 생성할 수 있습니다.",
        },
      };
    }
  }

  const duplicateCheck = await findExistingPendingInvitation(
    serviceClient,
    email,
    effectiveInvitedRole as UserRole,
    effectiveScopeType as ScopeType,
    normalizedScopeId,
  );

  if (duplicateCheck.error) {
    logServerError(
      "INVITATION_LOOKUP_FAILED",
      duplicateCheck.error.message ?? "Pending invitation lookup failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "INVITATION_LOOKUP_FAILED",
        message: "지금 기존 초대를 확인할 수 없습니다.",
      },
    };
  }

  if (duplicateCheck.invitation) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "INVITATION_ALREADY_PENDING",
        message: "이 이메일과 범위에는 이미 대기 중인 초대가 있습니다.",
      },
    };
  }

  const { rawToken, tokenHash } = createTokenPair();
  const expiresAt = createExpiresAt(expiresInDays);
  const invitationInsert: InvitationInsert = {
    invited_email: email,
    invited_role: effectiveInvitedRole as UserRole,
    scope_type: effectiveScopeType as ScopeType,
    scope_id: normalizedScopeId,
    invited_by: admin.profile.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    status: "pending",
  };

  const invitationsTable = serviceClient.from("invitations") as unknown as {
    insert: (
      values: InvitationInsert,
    ) => {
      select: (
        columns: string,
      ) => {
        single: () => Promise<{
          data: CreatedInvitationRow | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
  };

  const { data: invitation, error: invitationError } = await invitationsTable
    .insert(invitationInsert)
    .select(
      "id, invited_email, invited_role, scope_type, scope_id, expires_at, status",
    )
    .single();

  if (invitationError || !invitation) {
    if (isPendingInvitationUniqueError(invitationError)) {
      return {
        ok: false,
        error: {
          status: 409,
          code: "INVITATION_ALREADY_PENDING",
          message: "이 이메일과 범위에는 이미 대기 중인 초대가 있습니다.",
        },
      };
    }

    logServerError(
      "INVITATION_CREATE_FAILED",
      invitationError?.message ?? "Invitation create failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "INVITATION_CREATE_FAILED",
        message: "지금 초대를 생성할 수 없습니다.",
      },
    };
  }

  const origin = getAppOrigin(requestOrigin);
  const invitationUrl = createInvitationUrl(origin, rawToken);
  let emailDelivery: CreateInvitationSuccess["emailDelivery"] | undefined;

  if (sendEmail) {
    const emailResult = await sendInvitationEmail({
      to: invitation.invited_email,
      invitationUrl,
      expiresAt: invitation.expires_at,
    });

    emailDelivery = emailResult.ok
      ? { sent: true }
      : {
          sent: false,
          code: emailResult.code,
          message: emailResult.message,
        };
  }

  return {
    ok: true,
    data: {
      invitation_id: invitation.id,
      email: invitation.invited_email,
      invited_role: invitation.invited_role,
      scope_type: invitation.scope_type,
      scope_id: invitation.scope_id,
      expires_at: invitation.expires_at,
      status: invitation.status,
      invitationUrl,
      emailDelivery,
    },
  };
}
