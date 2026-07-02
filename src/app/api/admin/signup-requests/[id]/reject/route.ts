import { NextResponse } from "next/server";
import { rejectSignupRequest } from "@/lib/api/admin/signup-requests";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  const result = await rejectSignupRequest({ signupRequestId: id, reason });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.error.status, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(
    { ok: true, data: result.data },
    { headers: noStoreHeaders },
  );
}
