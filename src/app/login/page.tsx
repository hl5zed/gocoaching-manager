import { headers } from "next/headers";
import { LoginForm, type AuthLoginTranslations } from "./LoginForm";

export const dynamic = "force-dynamic";

type I18nMeta = {
  requested_language: string;
  resolved_language: string;
  namespace: string;
  key_count?: number;
  value_count?: number;
};

type I18nResponse =
  | {
      ok: true;
      data: Record<string, string>;
      meta: I18nMeta;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type I18nNamespaceResult = {
  data: Record<string, string>;
  meta: I18nMeta | null;
  error: string | null;
};

type LoginPageProps = {
  searchParams: Promise<{
    lang?: string | string[];
  }>;
};

const supportedLoginLanguages = new Set(["ko", "en", "th"]);

function normalizeLanguage(value: string | string[] | undefined) {
  const rawLanguage = Array.isArray(value) ? value[0] : value;
  const language = rawLanguage?.trim().toLowerCase() ?? "ko";
  return supportedLoginLanguages.has(language) ? language : "ko";
}

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return host ? `${protocol}://${host}` : "";
}

async function fetchI18nNamespace(
  origin: string,
  language: string,
  namespace: string,
): Promise<I18nNamespaceResult> {
  if (!origin) {
    return {
      data: {},
      meta: null,
      error: "origin을 확인하지 못해서 i18n API를 호출하지 못했습니다.",
    };
  }

  try {
    const response = await fetch(
      `${origin}/api/i18n/${encodeURIComponent(language)}/${encodeURIComponent(
        namespace,
      )}`,
      { cache: "no-store" },
    );
    const result = (await response.json()) as I18nResponse;

    if (!response.ok || !result.ok) {
      return {
        data: {},
        meta: null,
        error:
          result.ok === false
            ? result.error.message
            : `${namespace} 번역 API 호출에 실패했습니다.`,
      };
    }

    return {
      data: result.data,
      meta: result.meta,
      error: null,
    };
  } catch (error) {
    return {
      data: {},
      meta: null,
      error:
        error instanceof Error
          ? error.message
          : `${namespace} 번역 API 호출 중 오류가 발생했습니다.`,
    };
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const language = normalizeLanguage(params.lang);
  const origin = await getOrigin();
  const [commonI18n, authI18n] = await Promise.all([
    fetchI18nNamespace(origin, language, "common"),
    fetchI18nNamespace(origin, language, "auth"),
  ]);

  const authTranslations: AuthLoginTranslations = {
    login: authI18n.data.login,
    email: authI18n.data.email,
    password: authI18n.data.password,
    login_success: authI18n.data.login_success,
    login_required: authI18n.data.login_required,
    loading: commonI18n.data.loading,
    error: commonI18n.data.error,
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          GoCoaching Manager
        </p>

        <LoginForm translations={authTranslations} />
      </section>
    </main>
  );
}
