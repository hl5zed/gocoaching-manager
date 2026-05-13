import { NextResponse } from "next/server";
import {
  getAdminCoachingGenealogy,
  parseGenealogyFilters,
} from "@/lib/api/admin/coaching-genealogy";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = parseGenealogyFilters(url.searchParams);
  const result = await getAdminCoachingGenealogy(filters);

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
