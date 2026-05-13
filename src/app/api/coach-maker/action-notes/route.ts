import { NextResponse } from "next/server";
import {
  createCoachActionNote,
  getCoachActionNotes,
} from "@/lib/api/coach/action-notes";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function jsonResponse(
  body: Record<string, unknown>,
  status: 200 | 201 | 400 | 401 | 403 | 404 | 500,
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
  const result = await getCoachActionNotes(new URL(request.url).searchParams);

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
      notes: result.data,
    },
    200,
  );
}

export async function POST(request: Request) {
  const input = await readJson(request);
  const result = await createCoachActionNote(input);

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
      note: result.data,
      message: "관리 액션 메모가 생성되었습니다.",
    },
    201,
  );
}
