import { NextResponse } from "next/server";
import {
  approveSignupRequest,
  type SignupRequestApprovalAffiliation,
} from "@/lib/api/admin/signup-requests";
import type { ScopeType } from "@/types/database";
import { SCOPE_TYPES } from "@/types/database";

const noStoreHeaders = { "Cache-Control": "no-store" };

function normalizeId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeScopeType(value: unknown): ScopeType | null {
  return typeof value === "string" &&
    (SCOPE_TYPES as readonly string[]).includes(value)
    ? (value as ScopeType)
    : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const affiliation: SignupRequestApprovalAffiliation = {
    scopeType: normalizeScopeType(body?.scope_type),
    scopeId: normalizeId(body?.scope_id),
    countryId: normalizeId(body?.country_id),
    regionId: normalizeId(body?.region_id),
    organizationId: normalizeId(body?.organization_id),
    churchId: normalizeId(body?.church_id),
    groupId: normalizeId(body?.group_id),
  };

  const result = await approveSignupRequest({ signupRequestId: id, affiliation });

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
