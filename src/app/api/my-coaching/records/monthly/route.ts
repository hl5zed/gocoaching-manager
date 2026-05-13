import { NextResponse } from "next/server";
import {
  createMonthlyReflection,
  getMonthlyReflections,
} from "@/lib/api/my-coaching/monthly-reflections";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function jsonResponse(
  body: Record<string, unknown>,
  status: 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500,
) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const result = await getMonthlyReflections(new URL(request.url).searchParams);

  if (!result.ok) {
    return jsonResponse(
      {
        ok: false,
        message: result.message,
      },
      result.status,
    );
  }

  return jsonResponse(
    {
      ok: true,
      records: result.data,
    },
    200,
  );
}

export async function POST(request: Request) {
  const input = await readJson(request);
  const result = await createMonthlyReflection(input);

  if (!result.ok) {
    return jsonResponse(
      {
        ok: false,
        message: result.message,
      },
      result.status,
    );
  }

  return jsonResponse(
    {
      ok: true,
      record: result.data,
      message: "월간 회고가 저장되었습니다.",
    },
    201,
  );
}
