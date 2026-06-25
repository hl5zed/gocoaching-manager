import { NextResponse } from "next/server";
import { createAdminInvitation } from "@/lib/api/admin/create-invitation";


const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request) {
  let input: Record<string, unknown>;

  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_BODY",
          message: "Request body must be valid JSON.",
        },
      },
      {
        status: 400,
        headers: noStoreHeaders,
      },
    );
  }

  const result = await createAdminInvitation({
    input,
    requestOrigin: new URL(request.url).origin,
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
      status: 201,
      headers: noStoreHeaders,
    },
  );
}
