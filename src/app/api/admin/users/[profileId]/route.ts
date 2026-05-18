import { NextResponse } from "next/server";
import { getAdminUserDetail } from "@/lib/api/admin/users";
import { getSession } from "@/lib/auth/getSession";
import { ADMIN_WRITE_ROLES } from "@/lib/auth/require-admin-profile";
import { hasRole } from "@/lib/auth/has-role";
import { createApiPerformanceLogger } from "@/lib/performance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type AdminRoleLookupRow = {
  role: UserRole;
};

type AdminProfileLookupRow = {
  id: string;
};

async function requireAdminDetailAccess() {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false as const,
      status: 401 as const,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .neq("status", "anonymized")
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false as const,
      status: 403 as const,
    };
  }

  const adminProfile = profile as AdminProfileLookupRow;

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("profile_id", adminProfile.id)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    return {
      ok: false as const,
      status: 403 as const,
    };
  }

  const roleValues = ((roles ?? []) as AdminRoleLookupRow[]).map(
    (role) => role.role,
  );

  if (!hasRole(roleValues, ADMIN_WRITE_ROLES)) {
    return {
      ok: false as const,
      status: 403 as const,
    };
  }

  return {
    ok: true as const,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> | { profileId: string } },
) {
  const perf = createApiPerformanceLogger("/api/admin/users/[profileId]");
  const admin = await requireAdminDetailAccess();

  if (!admin.ok) {
    perf.mark("auth_denied");
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }
  perf.mark("detail.permissions_query", 1);

  const { profileId } = await Promise.resolve(context.params);

  if (!isUuid(profileId)) {
    perf.mark("invalid_profile_id");
    return NextResponse.json(
      { error: "회원 정보를 불러오지 못했습니다." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const detailResult = await getAdminUserDetail(profileId, perf);
  perf.mark("detail_lookup", detailResult.user ? 1 : 0);

  if (detailResult.error || !detailResult.user) {
    return NextResponse.json(
      { error: "회원 정보를 불러오지 못했습니다." },
      { status: detailResult.error === "Member not found." ? 404 : 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      user: detailResult.user,
    },
    { headers: NO_STORE_HEADERS },
  );
}
