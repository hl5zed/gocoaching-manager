import { NextResponse } from "next/server";
import { revokeAdminInvitation } from "@/lib/api/admin/revoke-invitation";


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
  _request: Request,
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

  const result = await revokeAdminInvitation({
    invitationId,
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
