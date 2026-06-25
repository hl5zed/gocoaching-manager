import { NextRequest, NextResponse } from "next/server";

import {
  createSystemAnnouncement,
  getAdminSystemAnnouncements,
  requireActiveSuperAdminForAnnouncements,
} from "@/lib/api/admin/system-announcements";


const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function errorStatus(message: string) {
  return message.includes("Supabase") || message.includes("못했습니다")
    ? 500
    : 400;
}

export async function GET() {
  const admin = await requireActiveSuperAdminForAnnouncements();

  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.message },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }

  const result = await getAdminSystemAnnouncements();

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_ANNOUNCEMENTS_ADMIN_GET_FAILED]", result.error);
    }

    return NextResponse.json(
      { error: result.error },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    { ok: true, announcements: result.announcements },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireActiveSuperAdminForAnnouncements();

  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.message },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 읽을 수 없습니다." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const result = await createSystemAnnouncement(
    (body ?? {}) as Record<string, unknown>,
    admin.profileId,
  );

  if (result.error || !result.announcement) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_ANNOUNCEMENTS_ADMIN_CREATE_FAILED]", result.error);
    }

    return NextResponse.json(
      { error: result.error ?? "시스템 공지를 저장하지 못했습니다." },
      {
        status: errorStatus(result.error ?? ""),
        headers: NO_STORE_HEADERS,
      },
    );
  }

  return NextResponse.json(
    { ok: true, announcement: result.announcement },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}
