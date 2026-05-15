import { NextRequest, NextResponse } from "next/server";

import {
  getGlobalSystemSettings,
  type UpdateGlobalSystemSettingsInput,
  updateGlobalSystemSettings,
} from "@/lib/api/admin/system-settings";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { validatePrintOptionsInput } from "@/lib/print/print-options";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const ALLOWED_SETTING_KEYS = [
  "default_locale",
  "default_country_id",
  "invitation_expires_in_days",
  "print_options",
] as const;

type AllowedSettingKey = (typeof ALLOWED_SETTING_KEYS)[number];

type DynamicSupabaseClient = {
  from: (table: string) => any;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requireSettingsAdmin() {
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

function hasUnknownKeys(body: Record<string, unknown>) {
  return Object.keys(body).filter(
    (key) => !ALLOWED_SETTING_KEYS.includes(key as AllowedSettingKey),
  );
}

async function validateCountryId(value: unknown): Promise<string | null | { error: string }> {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return { error: "기본 국가는 올바른 국가 ID여야 합니다." };
  }

  const { client, error: clientError } = createSupabaseServiceClient();
  if (!client) {
    return {
      error: clientError ?? "기본 국가를 확인하기 위한 서버 설정이 없습니다.",
    };
  }

  const supabase = client as unknown as DynamicSupabaseClient;
  const { data, error } = await supabase
    .from("countries")
    .select("id,is_active")
    .eq("id", value)
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_SETTINGS_COUNTRY_CHECK_FAILED]", error.message);
    }

    return { error: "기본 국가를 확인하지 못했습니다." };
  }

  if (!data) {
    return { error: "존재하지 않는 국가입니다." };
  }

  if (typeof data.is_active === "boolean" && !data.is_active) {
    return { error: "비활성 국가는 기본 국가로 설정할 수 없습니다." };
  }

  return value;
}

export async function GET() {
  const admin = await requireSettingsAdmin();
  if (!admin.ok) {
    return admin.response;
  }

  const result = await getGlobalSystemSettings();
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const admin = await requireSettingsAdmin();
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

  const unknownKeys = hasUnknownKeys(body);
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { error: `허용되지 않은 설정 항목입니다: ${unknownKeys.join(", ")}` },
      { status: 400 },
    );
  }

  const input: UpdateGlobalSystemSettingsInput = {};

  if ("default_locale" in body) {
    if (body.default_locale !== "ko" && body.default_locale !== "en") {
      return NextResponse.json(
        { error: "기본 언어는 ko 또는 en만 허용됩니다." },
        { status: 400 },
      );
    }

    input.default_locale = body.default_locale;
  }

  if ("default_country_id" in body) {
    const countryId = await validateCountryId(body.default_country_id);
    if (isRecord(countryId)) {
      return NextResponse.json({ error: countryId.error }, { status: 400 });
    }

    input.default_country_id = countryId;
  }

  if ("invitation_expires_in_days" in body) {
    const days = body.invitation_expires_in_days;
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 30
    ) {
      return NextResponse.json(
        { error: "초대 만료 기간은 1~30일 사이의 정수여야 합니다." },
        { status: 400 },
      );
    }

    input.invitation_expires_in_days = days;
  }

  if ("print_options" in body) {
    const printOptions = validatePrintOptionsInput(body.print_options);
    if (!printOptions.ok) {
      return NextResponse.json({ error: printOptions.error }, { status: 400 });
    }

    input.print_options = printOptions.value;
  }

  const result = await updateGlobalSystemSettings(input, admin.profileId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, settings: result.settings });
}
