import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/** DB 번역 JSON — Cache-Control과 함께 1시간 revalidate */
export const revalidate = 3600;

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

type TranslationKeyRow = {
  id: string;
  key: string;
};

type TranslationValueRow = {
  translation_key_id: string;
  value: string;
};

type TranslationLookupResult = {
  translations: Record<string, string>;
  keyCount: number;
  valueCount: number;
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

async function getActiveLanguageCodes(
  supabase: any,
  requestedLanguage: string,
) {
  const languageCodes = Array.from(new Set([requestedLanguage, "en", "ko"]));

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
  supabase: any,
  namespaceId: string,
  languageCode: string,
): Promise<TranslationLookupResult> {
  const translationKeysTable = supabase.from("translation_keys") as any;
  const translationValuesTable = supabase.from("translation_values") as any;

  const { data: keys, error: keysError } = await translationKeysTable
    .select("id, key")
    .eq("namespace_id", namespaceId)
    .eq("is_active", true);

  if (keysError) {
    throw keysError;
  }

  const keyRows = (keys ?? []) as TranslationKeyRow[];

  if (keyRows.length === 0) {
    return {
      translations: {},
      keyCount: 0,
      valueCount: 0,
    };
  }

  const keyById = new Map(keyRows.map((row) => [row.id, row.key]));

  const { data, error } = await translationValuesTable
    .select("translation_key_id, value")
    .in(
      "translation_key_id",
      keyRows.map((row) => row.id),
    )
    .eq("language_code", languageCode)
    .eq("review_status", "approved");

  if (error) {
    throw error;
  }

  const valueRows = (data ?? []) as TranslationValueRow[];
  const translations: Record<string, string> = {};

  for (const row of valueRows) {
    const key = keyById.get(row.translation_key_id);

    if (key) {
      translations[key] = row.value;
    }
  }

  return {
    translations,
    keyCount: keyRows.length,
    valueCount: valueRows.length,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { lang, namespace } = await context.params;
  const { client: serviceClient } = createSupabaseServiceClient();
  const supabase = serviceClient ?? (await createSupabaseServerClient());

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

  let resolvedLanguage = fallbackLanguages[fallbackLanguages.length - 1] ?? lang;
  let data: Record<string, string> = {};
  let resolvedKeyCount = 0;
  let resolvedValueCount = 0;

  for (const languageCode of fallbackLanguages) {
    const lookup = await getTranslationsForLanguage(
      supabase,
      resolvedNamespace.id,
      languageCode,
    );

    resolvedLanguage = languageCode;
    data = lookup.translations;
    resolvedKeyCount = lookup.keyCount;
    resolvedValueCount = lookup.valueCount;

    if (Object.keys(lookup.translations).length > 0) {
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
        read_client: serviceClient ? "service_role" : "server_session",
        key_count: resolvedKeyCount,
        value_count: resolvedValueCount,
      },
    },
    {
      headers: cacheHeaders,
    },
  );
}
