import { NextResponse } from "next/server";
import { assignCoachingGenealogy } from "@/lib/api/admin/coaching-genealogy";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "요청 본문을 확인해 주세요.",
        },
      },
      {
        status: 400,
        headers: noStoreHeaders,
      },
    );
  }

  const result = await assignCoachingGenealogy(
    body && typeof body === "object" ? body : {},
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
      },
      {
        status: result.status,
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
