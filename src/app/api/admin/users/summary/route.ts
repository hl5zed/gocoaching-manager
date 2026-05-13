import { NextResponse } from "next/server";
import { getAdminUserRoleSummary } from "@/lib/api/admin/users";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET() {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }

  const { summary, error } = await getAdminUserRoleSummary();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ADMIN_USERS_SUMMARY_API] summary lookup failed", error);
    }

    return NextResponse.json(
      { error: "요약 정보를 불러오지 못했습니다." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(summary, { headers: NO_STORE_HEADERS });
}
