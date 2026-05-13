import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { isActiveLocale, type ActiveLocale } from "@/lib/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type LocaleProfileRow = {
  preferred_locale: string | null;
};

type LocaleProfileTable = {
  select: (columns: string) => {
    eq: (column: "auth_user_id", value: string) => {
      neq: (column: "status", value: string) => {
        is: (column: "deleted_at", value: null) => {
          maybeSingle: () => Promise<{
            data: LocaleProfileRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  update: (values: {
    locale_updated_at: string;
    preferred_locale: ActiveLocale;
  }) => {
    eq: (column: "auth_user_id", value: string) => {
      neq: (column: "status", value: string) => {
        is: (column: "deleted_at", value: null) => {
          select: (columns: string) => {
            maybeSingle: () => Promise<{
              data: LocaleProfileRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
};

function readLocale(body: unknown) {
  if (!body || typeof body !== "object" || !("locale" in body)) {
    return null;
  }

  return (body as { locale?: unknown }).locale;
}

export async function GET() {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const profiles = supabase.from("profiles") as unknown as LocaleProfileTable;

    const { data, error } = await profiles
      .select("preferred_locale")
      .eq("auth_user_id", session.user.id)
      .neq("status", "anonymized")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("[PROFILE_LOCALE_LOOKUP_FAILED]", error);
      return NextResponse.json(
        { ok: false, error: "언어 설정을 조회하지 못했습니다." },
        { status: 500, headers: noStoreHeaders },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        locale: isActiveLocale(data?.preferred_locale)
          ? data.preferred_locale
          : null,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("[PROFILE_LOCALE_LOOKUP_FAILED]", error);
    return NextResponse.json(
      { ok: false, error: "언어 설정을 조회하지 못했습니다." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 body가 올바른 JSON 형식이 아닙니다." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const locale = readLocale(body);

  if (!isActiveLocale(locale)) {
    return NextResponse.json(
      { ok: false, error: "지원하지 않는 언어입니다." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const profiles = supabase.from("profiles") as unknown as LocaleProfileTable;

    const { data, error } = await profiles
      .update({
        preferred_locale: locale,
        locale_updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", session.user.id)
      .neq("status", "anonymized")
      .is("deleted_at", null)
      .select("preferred_locale")
      .maybeSingle();

    if (error) {
      console.error("[PROFILE_LOCALE_UPDATE_FAILED]", error);
      return NextResponse.json(
        { ok: false, error: "언어 설정을 저장하지 못했습니다." },
        { status: 500, headers: noStoreHeaders },
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "프로필을 찾을 수 없습니다." },
        { status: 404, headers: noStoreHeaders },
      );
    }

    return NextResponse.json(
      { ok: true, locale },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("[PROFILE_LOCALE_UPDATE_FAILED]", error);
    return NextResponse.json(
      { ok: false, error: "언어 설정을 저장하지 못했습니다." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
