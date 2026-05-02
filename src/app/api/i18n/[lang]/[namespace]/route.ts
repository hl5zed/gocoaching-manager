import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const cacheHeaders = {
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
};

type RouteContext = {
  params: Promise<{
    lang: string;
    namespace: string;
  }>;
};

type TranslationNamespace = {
  id: string;
  name: string;
};

type TranslationValueRow = {
  value: string;
  translation_keys:
    | {
        key: string;
      }
    | {
        key: string;
      }[]
    | null;
};

function notFoundResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "I18N_NOT_FOUND",
        message: "요청한 언어 또는 번역 영역을 찾을 수 없습니다.",
      },
    },
    {
      status: 404,
      headers: cacheHeaders,
    },
  );
}

function getTranslationKey(row: TranslationValueRow) {
  if (Array.isArray(row.translation_keys)) {
    return row.translation_keys[0]?.key ?? null;
  }

  return row.translation_keys?.key ?? null;
}

async function getActiveLanguageCodes(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  requestedLanguage: string,
) {
  const languageCodes = Array.from(
    new Set([requestedLanguage, "en", "ko"]),
  );

  const { data, error } = await supabase
    .from("supported_languages")
    .select("code")
    .in("code", languageCodes)
    .eq("is_active", true);

  if (error) {
    return null;
  }

  return new Set(
    ((data ?? []) as { code: string }[]).map((language) => language.code),
  );
}

async function getTranslationsForLanguage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  namespaceId: string,
  languageCode: string,
) {
  const translationValuesTable = supabase.from("translation_values") as any;

  const { data, error } = await translationValuesTable
    .select(
      "value, translation_keys!inner(key, namespace_id, is_active)",
    )
    .eq("language_code", languageCode)
    .eq("review_status", "approved")
    .eq("translation_keys.namespace_id", namespaceId)
    .eq("translation_keys.is_active", true);

  if (error) {
    throw error;
  }

  const translations: Record<string, string> = {};

  for (const row of (data ?? []) as TranslationValueRow[]) {
    const key = getTranslationKey(row);

    if (key) {
      translations[key] = row.value;
    }
  }

  return translations;
}

export async function GET(_request: Request, context: RouteContext) {
  const { lang, namespace } = await context.params;
  const supabase = await createSupabaseServerClient();

  const activeLanguageCodes = await getActiveLanguageCodes(supabase, lang);

  if (!activeLanguageCodes?.has(lang)) {
    return notFoundResponse();
  }

  const { data: namespaceRow, error: namespaceError } = await supabase
    .from("translation_namespaces")
    .select("id, name")
    .eq("name", namespace)
    .eq("is_active", true)
    .maybeSingle();

  if (namespaceError || !namespaceRow) {
    return notFoundResponse();
  }

  const resolvedNamespace = namespaceRow as TranslationNamespace;
  const fallbackLanguages = [lang, "en", "ko"].filter(
    (languageCode, index, languages) =>
      languages.indexOf(languageCode) === index &&
      activeLanguageCodes.has(languageCode),
  );

  let resolvedLanguage =
    fallbackLanguages[fallbackLanguages.length - 1] ?? lang;
  let data: Record<string, string> = {};

  for (const languageCode of fallbackLanguages) {
    const translations = await getTranslationsForLanguage(
      supabase,
      resolvedNamespace.id,
      languageCode,
    );

    resolvedLanguage = languageCode;
    data = translations;

    if (Object.keys(translations).length > 0) {
      break;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      data,
      meta: {
        requested_language: lang,
        resolved_language: resolvedLanguage,
        namespace: resolvedNamespace.name,
      },
    },
    {
      headers: cacheHeaders,
    },
  );
}
