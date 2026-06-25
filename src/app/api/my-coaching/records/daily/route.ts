import { NextResponse } from "next/server";
import {
  createDailyRecord,
  getDailyRecords,
} from "@/lib/api/my-coaching/daily-records";


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
  const result = await getDailyRecords(new URL(request.url).searchParams);

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
  const result = await createDailyRecord(input);

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
      message: "하루 기록이 저장되었습니다.",
    },
    201,
  );
}
