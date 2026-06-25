import { NextResponse } from "next/server";
import {
  getAdminGenerationHistory,
  parseGenerationHistoryFilters,
} from "@/lib/api/admin/coaching-genealogy";


const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await getAdminGenerationHistory(
    parseGenerationHistoryFilters(url.searchParams),
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
      },
      {
        headers: noStoreHeaders,
        status: result.status,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: result.data,
    },
    {
      headers: noStoreHeaders,
      status: 200,
    },
  );
}
