import { NextResponse } from "next/server";
import {
  getAdminCoachingGenealogy,
  parseGenealogyFilters,
} from "@/lib/api/admin/coaching-genealogy";
import { createApiPerformanceLogger } from "@/lib/performance";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const perf = createApiPerformanceLogger("/api/admin/coaching-genealogy");
  const url = new URL(request.url);
  const filters = parseGenealogyFilters(url.searchParams);
  perf.mark("filters_parsed");
  const result = await getAdminCoachingGenealogy(filters, perf);

  if (!result.ok) {
    perf.mark("failed");
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

  perf.mark("complete", result.data.nodes.length);

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
