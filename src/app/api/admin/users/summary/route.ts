import { NextResponse } from "next/server";
import { getAdminUserRoleSummary } from "@/lib/api/admin/users";
import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { ADMIN_WRITE_ROLES } from "@/lib/auth/require-admin-profile";
import { hasRole } from "@/lib/auth/has-role";
import { createApiPerformanceLogger } from "@/lib/performance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type AdminProfileLookupRow = {
  id: string;
};

type AdminRoleLookupRow = {
  role: UserRole;
};

async function requireAdminSummaryAccess() {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false as const,
      status: 401 as const,
      roleCount: 0,
    };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase
    .from("profiles")
    .select("id")
    .neq("status", "anonymized")
    .is("deleted_at", null);

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false as const,
      status: 403 as const,
      roleCount: 0,
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
      roleCount: 0,
    };
  }

  const roleValues = ((roles ?? []) as AdminRoleLookupRow[]).map(
    (role) => role.role,
  );

  if (!hasRole(roleValues, ADMIN_WRITE_ROLES)) {
    return {
      ok: false as const,
      status: 403 as const,
      roleCount: roleValues.length,
    };
  }

  return {
    ok: true as const,
    roleCount: roleValues.length,
  };
}

export async function GET() {
  const perf = createApiPerformanceLogger("/api/admin/users/summary");
  const admin = await requireAdminSummaryAccess();

  if (!admin.ok) {
    perf.mark("auth.permissions_query");
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }
  perf.mark("auth.permissions_query", admin.roleCount);

  const { summary, error } = await getAdminUserRoleSummary(perf);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ADMIN_USERS_SUMMARY_API] summary lookup failed", error);
    }

    return NextResponse.json(
      { error: "요약 정보를 불러오지 못했습니다." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  perf.mark("summary.complete", summary.totalProfiles);

  return NextResponse.json(summary, { headers: NO_STORE_HEADERS });
}
