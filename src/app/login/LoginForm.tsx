"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/useI18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthLoginTranslations = {
  login?: string;
  email?: string;
  password?: string;
  login_description?: string;
  login_success?: string;
  login_required?: string;
  loading?: string;
  error?: string;
};

type LoginFormProps = {
  translations: AuthLoginTranslations;
};

const DEFAULT_LOGIN_REDIRECT_PATH = "/dashboard";

function getFriendlyLoginError(message: string, fallbackMessage: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid login credentials")) {
    return fallbackMessage;
  }

  if (lowerMessage.includes("email not confirmed")) {
    return fallbackMessage;
  }

  if (lowerMessage.includes("failed to fetch")) {
    return fallbackMessage;
  }

  return `${fallbackMessage}: ${message}`;
}

function safeRedirectPath(value: string | null) {
  const path = value?.trim();

  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  if (path.startsWith("/login")) {
    return null;
  }

  return path;
}

function clearBrowserSupabaseAuthCookies() {
  if (typeof document === "undefined") {
    return;
  }

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name?.startsWith("sb-")) {
      continue;
    }

    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  }
}

export function LoginForm({ translations }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginText = t("auth.login", translations.login ?? "로그인");
  const emailText = t("auth.email", translations.email ?? "이메일");
  const passwordText = t("auth.password", translations.password ?? "비밀번호");
  const loginDescriptionText = t(
    "auth.loginDescription",
    translations.login_description ??
      "Supabase Auth에 등록된 이메일과 비밀번호로 로그인합니다.",
  );
  const loadingText = t("common.loading", translations.loading ?? "불러오는 중");
  const errorText = t("common.error", translations.error ?? "오류");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    clearBrowserSupabaseAuthCookies();

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(getFriendlyLoginError(error.message, errorText));
      return;
    }

    const requestedPath =
      safeRedirectPath(searchParams.get("redirectTo")) ??
      safeRedirectPath(searchParams.get("next"));
    const nextPath = requestedPath ?? DEFAULT_LOGIN_REDIRECT_PATH;

    router.replace(nextPath);
  }

  return (
    <>
      <h1 className="mt-6 text-3xl font-semibold">{loginText}</h1>
      <p className="mt-4 leading-7 text-ink-muted">
        {loginDescriptionText}
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="email"
          >
            {emailText}
          </label>
          <input
            autoComplete="email"
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              className="block text-sm font-medium text-ink-base"
              htmlFor="password"
            >
              {passwordText}
            </label>
            <a
              className="text-sm font-medium text-brand-600 underline"
              href="/password-reset"
              tabIndex={-1}
            >
              비밀번호 재설정
            </a>
          </div>
          <input
            autoComplete="current-password"
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>

        {errorMessage && (
          <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <button
          className="w-full rounded-control bg-navy-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? `${loadingText}...` : loginText}
        </button>
      </form>
    </>
  );
}
