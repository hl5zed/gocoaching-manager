import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  sendInvitationEmail,
  type SendInvitationEmailResult,
} from "@/lib/email/send-invitation-email";
import {
  type Database,
  type InvitationRow,
  type InvitationStatus,
  type ScopeType,
  type UserRole,
} from "@/types/database";

type InvitationLookupRow = Pick<
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

type ResentInvitationRow = Pick<
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
  message?: string;
};

export type ResendInvitationSuccess = {
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

export type ResendInvitationError = {
  status: number;
  code: string;
  message: string;
};

export type ResendInvitationResult =
  | {
      ok: true;
      data: ResendInvitationSuccess;
    }
  | {
      ok: false;
      error: ResendInvitationError;
    };

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
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

function isExpiredInvitation(invitation: InvitationLookupRow) {
  return (
    invitation.status === "expired" ||
    new Date(invitation.expires_at).getTime() <= Date.now()
  );
}

function createInvitationResendTable(serviceClient: SupabaseClient<Database>) {
  type InvitationUpdateChain = {
    eq: (
      column: "id",
      value: string,
    ) => InvitationUpdateChain;
    is: (
      column: "accepted_at" | "deleted_at",
      value: null,
    ) => InvitationUpdateChain;
    in: (
      column: "status",
      value: Array<"pending" | "expired">,
    ) => {
      select: (
        columns: string,
      ) => {
        maybeSingle: () => Promise<{
          data: ResentInvitationRow | null;
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
          data: InvitationLookupRow | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
    update: (
      values: {
        token_hash: string;
        status: "pending";
        expires_at: string;
        updated_at: string;
      },
    ) => InvitationUpdateChain;
  };
}

export async function resendAdminInvitation({
  invitationId,
  requestOrigin,
  expiresInDaysInput,
  sendEmailInput,
}: {
  invitationId: string;
  requestOrigin: string;
  expiresInDaysInput?: unknown;
  sendEmailInput?: unknown;
}): Promise<ResendInvitationResult> {
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

  const expiresInDays = normalizeExpiresInDays(expiresInDaysInput);
  const sendEmail = normalizeSendEmail(sendEmailInput);

  if (expiresInDays === null) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_EXPIRATION",
        message: "Expiration must be between 1 and 30 days.",
      },
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Invitation resend service client is unavailable.",
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

  const invitationsTable = createInvitationResendTable(serviceClient);
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
        message: "Accepted invitations cannot be regenerated.",
      },
    };
  }

  if (invitation.status === "revoked") {
    return {
      ok: false,
      error: {
        status: 409,
        code: "INVITE_REVOKED",
        message: "Revoked invitations cannot be regenerated.",
      },
    };
  }

  const eligible =
    invitation.accepted_at === null &&
    invitation.deleted_at === null &&
    (invitation.status === "pending" || isExpiredInvitation(invitation));

  if (!eligible) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "INVITE_STATE_CHANGED",
        message: "Invitation state changed. Please refresh and try again.",
      },
    };
  }

  const { rawToken, tokenHash } = createTokenPair();
  const expiresAt = createExpiresAt(expiresInDays);
  const now = new Date().toISOString();

  const { data: resentInvitation, error: resendError } = await invitationsTable
    .update({
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
      updated_at: now,
    })
    .eq("id", invitation.id)
    .is("accepted_at", null)
    .is("deleted_at", null)
    .in("status", ["pending", "expired"])
    .select(
      "id, invited_email, invited_role, scope_type, scope_id, expires_at, status",
    )
    .maybeSingle();

  if (resendError) {
    logServerError(
      "INVITATION_RESEND_FAILED",
      resendError.message ?? "Invitation resend failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "INVITATION_RESEND_FAILED",
        message: "Unable to regenerate invitation right now.",
      },
    };
  }

  if (!resentInvitation) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "INVITE_STATE_CHANGED",
        message: "Invitation state changed. Please refresh and try again.",
      },
    };
  }

  const origin = getAppOrigin(requestOrigin);
  const invitationUrl = createInvitationUrl(origin, rawToken);
  let emailDelivery: ResendInvitationSuccess["emailDelivery"] | undefined;

  if (sendEmail) {
    const emailResult = await sendInvitationEmail({
      to: resentInvitation.invited_email,
      invitationUrl,
      expiresAt: resentInvitation.expires_at,
    });

    emailDelivery = emailResult.ok
      ? { sent: true }
      : {
          sent: false,
          code: emailResult.code,
          message: emailResult.message,
        };
  }

  // Audit logging intentionally skipped here.
  // There is no semantically correct existing audit action for invitation link
  // regeneration in the current shared AuditAction type / DB constraints.

  return {
    ok: true,
    data: {
      invitation_id: resentInvitation.id,
      email: resentInvitation.invited_email,
      invited_role: resentInvitation.invited_role,
      scope_type: resentInvitation.scope_type,
      scope_id: resentInvitation.scope_id,
      expires_at: resentInvitation.expires_at,
      status: resentInvitation.status,
      invitationUrl,
      emailDelivery,
    },
  };
}
