import { SignupForm, type SignupTranslations } from "./SignupForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DEFAULT_LOCALE,
  isActiveLocale,
  type ActiveLocale,
} from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";

type SignupPageProps = {
  searchParams: Promise<{
    lang?: string | string[];
  }>;
};

function normalizeLanguage(value: string | string[] | undefined): ActiveLocale {
  const rawLanguage = Array.isArray(value) ? value[0] : value;
  const language = rawLanguage?.trim().toLowerCase();
  return isActiveLocale(language) ? language : DEFAULT_LOCALE;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const language = normalizeLanguage(params.lang);
  const dictionary = messages[language] ?? messages[DEFAULT_LOCALE];
  const t = (key: string, fallback: string) => dictionary[key] ?? fallback;

  const translations: SignupTranslations = {
    title: t("auth.signup.title", "가입 신청"),
    description: t(
      "auth.signup.description",
      "아래 정보를 입력해 가입을 신청하면, 관리자 승인 후 계정이 생성됩니다.",
    ),
    name: t("auth.signup.name", "이름"),
    email: t("auth.signup.email", "이메일"),
    role: t("auth.signup.role", "희망 역할"),
    roleCoachee: t("auth.signup.roleCoachee", "코치이로 신청"),
    roleCoach: t("auth.signup.roleCoach", "코치로 신청"),
    submit: t("auth.signup.submit", "가입 신청하기"),
    submitting: t("auth.signup.submitting", "신청 중..."),
    success: t(
      "auth.signup.success",
      "가입 신청이 접수되었습니다. 관리자 승인 후 이메일로 안내드립니다.",
    ),
    duplicatePending: t(
      "auth.signup.duplicatePending",
      "이미 처리 대기 중인 신청이 있습니다.",
    ),
    error: t("auth.signup.error", "가입 신청 중 오류가 발생했습니다."),
    backToLogin: t("auth.signup.backToLogin", "로그인으로 돌아가기"),
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

        <SignupForm translations={translations} />
      </section>
    </main>
  );
}
