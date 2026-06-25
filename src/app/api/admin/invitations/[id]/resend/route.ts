import { NextResponse } from "next/server";
import { resendAdminInvitation } from "@/lib/api/admin/resend-invitation";


const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function normalizeInvitationId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const invitationId = normalizeInvitationId(params.id);

  if (!invitationId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MISSING_INVITATION_ID",
          message: "Invitation ID is required.",
        },
      },
      {
        status: 400,
        headers: noStoreHeaders,
      },
    );
  }

  let body: Record<string, unknown> = {};

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = await resendAdminInvitation({
    invitationId,
    requestOrigin: new URL(request.url).origin,
    expiresInDaysInput: body.expires_in_days,
    sendEmailInput: body.send_email,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      },
      {
        status: result.error.status,
        headers: noStoreHeaders,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: result.data,
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}
