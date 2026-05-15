import { NextRequest, NextResponse } from "next/server";

import {
  requireActiveSuperAdminForAnnouncements,
  softDeleteSystemAnnouncement,
  updateSystemAnnouncement,
} from "@/lib/api/admin/system-announcements";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function errorStatus(message: string) {
  return message.includes("Supabase") || message.includes("못했습니다")
    ? 500
    : 400;
}

async function getAnnouncementId(context: RouteContext) {
  const params = await context.params;
  const id = params.id?.trim();
  return id || null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireActiveSuperAdminForAnnouncements();

  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.message },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }

  const id = await getAnnouncementId(context);
  if (!id) {
    return NextResponse.json(
      { error: "공지 ID가 필요합니다." },
      { status: 400, headers: NO_STORE_HEADERS },
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

  const result = await updateSystemAnnouncement(
    id,
    (body ?? {}) as Record<string, unknown>,
    admin.profileId,
  );

  if (result.error || !result.announcement) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_ANNOUNCEMENTS_ADMIN_UPDATE_FAILED]", result.error);
    }

    return NextResponse.json(
      { error: result.error ?? "시스템 공지를 수정하지 못했습니다." },
      {
        status: errorStatus(result.error ?? ""),
        headers: NO_STORE_HEADERS,
      },
    );
  }

  return NextResponse.json(
    { ok: true, announcement: result.announcement },
    { headers: NO_STORE_HEADERS },
  );
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const admin = await requireActiveSuperAdminForAnnouncements();

  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.message },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }

  const id = await getAnnouncementId(context);
  if (!id) {
    return NextResponse.json(
      { error: "공지 ID가 필요합니다." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const result = await softDeleteSystemAnnouncement(id, admin.profileId);

  if (result.error || !result.announcement) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_ANNOUNCEMENTS_ADMIN_DELETE_FAILED]", result.error);
    }

    return NextResponse.json(
      { error: result.error ?? "시스템 공지를 삭제하지 못했습니다." },
      {
        status: errorStatus(result.error ?? ""),
        headers: NO_STORE_HEADERS,
      },
    );
  }

  return NextResponse.json(
    { ok: true, announcement: result.announcement },
    { headers: NO_STORE_HEADERS },
  );
}
