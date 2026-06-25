import { LoginForm, type AuthLoginTranslations } from "./LoginForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DEFAULT_LOCALE,
  isActiveLocale,
  type ActiveLocale,
} from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";


type LoginPageProps = {
  searchParams: Promise<{
    lang?: string | string[];
  }>;
};

function normalizeLanguage(value: string | string[] | undefined): ActiveLocale {
  const rawLanguage = Array.isArray(value) ? value[0] : value;
  const language = rawLanguage?.trim().toLowerCase();
  return isActiveLocale(language) ? language : DEFAULT_LOCALE;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const language = normalizeLanguage(params.lang);
  const dictionary = messages[language] ?? messages[DEFAULT_LOCALE];
  const t = (key: string, fallback: string) => dictionary[key] ?? fallback;

  const authTranslations: AuthLoginTranslations = {
    login: t("auth.login", "로그인"),
    email: t("auth.email", "이메일"),
    password: t("auth.password", "비밀번호"),
    login_description: t(
      "auth.loginDescription",
      "Supabase Auth에 등록된 이메일과 비밀번호로 로그인합니다.",
    ),
    login_success: t("auth.loginSuccess", "로그인되었습니다."),
    login_required: t("auth.loginRequired", "로그인이 필요합니다."),
    loading: t("common.loading", "불러오는 중"),
    error: t("common.error", "오류"),
  };

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
            GoCoaching Manager
          </p>
          <LanguageSwitcher />
        </div>

        <LoginForm translations={authTranslations} />
      </section>
    </main>
  );
}
