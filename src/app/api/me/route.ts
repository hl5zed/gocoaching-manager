import { NextResponse } from "next/server";
import { getProfile } from "@/lib/profile/getProfile";
import { updateProfile } from "@/lib/profile/updateProfile";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function getStatusFromErrorCode(code: string) {
  if (code === "UNAUTHORIZED") {
    return 401;
  }

  if (code === "PROFILE_NOT_FOUND") {
    return 404;
  }

  if (
    code === "INVALID_BODY" ||
    code === "DISALLOWED_PROFILE_FIELDS" ||
    code === "INVALID_PROFILE_FIELD_VALUE" ||
    code === "INVALID_LANGUAGE"
  ) {
    return 400;
  }

  return 500;
}

export async function GET() {
  const result = await getProfile();

  if (result.error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      },
      {
        status: getStatusFromErrorCode(result.error.code),
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
      headers: noStoreHeaders,
    },
  );
}

export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_BODY",
          message: "요청 body가 올바른 JSON 형식이 아닙니다.",
        },
      },
      {
        status: 400,
        headers: noStoreHeaders,
      },
    );
  }

  const result = await updateProfile(body);

  if (result.error) {
    const { code, message, fields } = result.error;

    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message,
          ...(fields ? { fields } : {}),
        },
      },
      {
        status: getStatusFromErrorCode(code),
        headers: noStoreHeaders,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      profile: result.profile,
    },
    {
      headers: noStoreHeaders,
    },
  );
}
