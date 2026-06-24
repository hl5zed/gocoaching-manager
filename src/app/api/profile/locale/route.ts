import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { isActiveLocale, type ActiveLocale } from "@/lib/i18n/config";
import { createApiPerformanceLogger } from "@/lib/performance";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type LocaleProfileRow = {
  preferred_locale: string | null;
};

type LocaleCacheEntry = {
  expiresAt: number;
  locale: ActiveLocale | null;
};

const LOCALE_CACHE_TTL_MS = 3 * 60 * 1000;
const localeCache = new Map<string, LocaleCacheEntry>();

type LocaleProfileTable = {
  select: (columns: string) => {
    eq: (column: "auth_user_id" | "id", value: string) => {
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
    eq: (column: "auth_user_id" | "id", value: string) => {
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
  const perf = createApiPerformanceLogger("/api/profile/locale");
  const session = await getSession();
  perf.mark("auth.session_check", session.user ? 1 : 0);

  if (!session.user) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const cacheKey = session.user.id;
  const cached = localeCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    perf.mark("profile.locale_lookup", 1);
    perf.mark("locale.complete", 1);
    return NextResponse.json(
      {
        ok: true,
        locale: cached.locale,
      },
      { headers: noStoreHeaders },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const profiles = supabase.from("profiles") as unknown as LocaleProfileTable;
    const verifiedProfileId = await getVerifiedProfileId();

    const { data, error } = verifiedProfileId
      ? await profiles
          .select("preferred_locale")
          .eq("id", verifiedProfileId)
          .neq("status", "anonymized")
          .is("deleted_at", null)
          .maybeSingle()
      : await profiles
          .select("preferred_locale")
          .eq("auth_user_id", session.user.id)
          .neq("status", "anonymized")
          .is("deleted_at", null)
          .maybeSingle();

    perf.mark("profile.locale_lookup", data ? 1 : 0);

    if (error) {
      console.error("[PROFILE_LOCALE_LOOKUP_FAILED]", error);
      return NextResponse.json(
        { ok: false, error: "언어 설정을 조회하지 못했습니다." },
        { status: 500, headers: noStoreHeaders },
      );
    }

    const locale = isActiveLocale(data?.preferred_locale)
      ? data.preferred_locale
      : null;

    // locale 변경 직후 최대 3분 반영 지연 가능.
    localeCache.set(cacheKey, {
      expiresAt: Date.now() + LOCALE_CACHE_TTL_MS,
      locale,
    });
    perf.mark("locale.complete", locale ? 1 : 0);

    return NextResponse.json(
      {
        ok: true,
        locale,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    perf.mark("profile.locale_lookup", 0);
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
    const verifiedProfileId = await getVerifiedProfileId();
    const updatePayload = {
      preferred_locale: locale,
      locale_updated_at: new Date().toISOString(),
    };

    const { data, error } = verifiedProfileId
      ? await profiles
          .update(updatePayload)
          .eq("id", verifiedProfileId)
          .neq("status", "anonymized")
          .is("deleted_at", null)
          .select("preferred_locale")
          .maybeSingle()
      : await profiles
          .update(updatePayload)
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

    localeCache.set(session.user.id, {
      expiresAt: Date.now() + LOCALE_CACHE_TTL_MS,
      locale,
    });

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
