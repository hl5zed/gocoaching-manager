import { NextResponse } from "next/server";
import {
  softDeleteCoachActionNote,
  updateCoachActionNote,
} from "@/lib/api/coach/action-notes";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonResponse(
  body: Record<string, unknown>,
  status: 200 | 400 | 401 | 403 | 404 | 500,
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

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const input = await readJson(request);
  const result = await updateCoachActionNote(id, input);

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
      message: "관리 액션 메모가 수정되었습니다.",
    },
    200,
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await softDeleteCoachActionNote(id);

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
      message: "관리 액션 메모가 삭제되었습니다.",
    },
    200,
  );
}
