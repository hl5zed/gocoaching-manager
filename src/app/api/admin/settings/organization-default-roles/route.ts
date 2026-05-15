import { NextRequest, NextResponse } from "next/server";

import {
  getOrganizationDefaultRoleSettings,
  updateOrganizationDefaultRolePolicy,
} from "@/lib/api/admin/system-settings";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requireOrganizationDefaultRoleAdmin() {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: admin.status }),
    };
  }

  if (!admin.roles.includes("super_admin")) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const { data: activeProfile, error: profileError } = await admin.supabase
    .from("profiles")
    .select("id")
    .eq("id", admin.profile.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError || !activeProfile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    profileId: admin.profile.id,
  };
}

export async function GET() {
  const admin = await requireOrganizationDefaultRoleAdmin();
  if (!admin.ok) {
    return admin.response;
  }

  const result = await getOrganizationDefaultRoleSettings();
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const admin = await requireOrganizationDefaultRoleAdmin();
  if (!admin.ok) {
    return admin.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (typeof body.organization_id !== "string" || body.organization_id.trim() === "") {
    return NextResponse.json({ error: "조직을 선택해 주세요." }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "사용 여부는 true 또는 false여야 합니다." },
      { status: 400 },
    );
  }

  const result = await updateOrganizationDefaultRolePolicy({
    organizationId: body.organization_id,
    enabled: body.enabled,
    defaultRole: body.default_role,
    updatedByProfileId: admin.profileId,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({ ok: true, policy: result.policy });
}

export const POST = PATCH;
