"use client";

import { FormEvent, useState } from "react";
import { useI18n } from "@/lib/i18n/useI18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SignupRequestInsert, UserRole } from "@/types/database";

type SignupRequestsInsertTable = {
  insert: (
    values: SignupRequestInsert,
  ) => Promise<{ error: { code?: string; message?: string } | null }>;
};

export type SignupTranslations = {
  title?: string;
  description?: string;
  name?: string;
  email?: string;
  role?: string;
  roleCoachee?: string;
  roleCoach?: string;
  submit?: string;
  submitting?: string;
  success?: string;
  duplicatePending?: string;
  error?: string;
  backToLogin?: string;
};

type SignupFormProps = {
  translations: SignupTranslations;
};

const SELF_SIGNUP_ROLES: UserRole[] = ["coachee", "coach"];

const UNIQUE_VIOLATION_CODE = "23505";

// Mirrors MINISTRY_POSITION_OPTIONS in AdminUserDirectCreatePanel.tsx.
const MINISTRY_POSITION_OPTIONS = [
  "목사",
  "선교사",
  "전도사",
  "장로",
  "권사",
  "집사",
  "목자",
  "순장",
  "교사",
  "리더",
  "성도",
  "기타",
];

export function SignupForm({ translations }: SignupFormProps) {
  const { locale, t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestedRole, setRequestedRole] = useState<UserRole>("coachee");
  const [affiliationText, setAffiliationText] = useState("");
  const [regionText, setRegionText] = useState("");
  const [generationText, setGenerationText] = useState("");
  const [ministryPosition, setMinistryPosition] = useState("");
  const [selfIntroduction, setSelfIntroduction] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleText = t("auth.signup.title", translations.title ?? "가입 신청");
  const descriptionText = t(
    "auth.signup.description",
    translations.description ??
      "아래 정보를 입력해 가입을 신청하면, 관리자 승인 후 계정이 생성됩니다.",
  );
  const nameText = t("auth.signup.name", translations.name ?? "이름");
  const emailText = t("auth.signup.email", translations.email ?? "이메일");
  const roleText = t("auth.signup.role", translations.role ?? "희망 역할");
  const roleCoacheeText = t(
    "auth.signup.roleCoachee",
    translations.roleCoachee ?? "코치이로 신청",
  );
  const roleCoachText = t(
    "auth.signup.roleCoach",
    translations.roleCoach ?? "코치로 신청",
  );
  const submitText = t("auth.signup.submit", translations.submit ?? "가입 신청하기");
  const submittingText = t(
    "auth.signup.submitting",
    translations.submitting ?? "신청 중...",
  );
  const successText = t(
    "auth.signup.success",
    translations.success ??
      "가입 신청이 접수되었습니다. 관리자 승인 후 이메일로 안내드립니다.",
  );
  const duplicatePendingText = t(
    "auth.signup.duplicatePending",
    translations.duplicatePending ?? "이미 처리 대기 중인 신청이 있습니다.",
  );
  const errorText = t("auth.signup.error", translations.error ?? "가입 신청 중 오류가 발생했습니다.");
  const backToLoginText = t(
    "auth.signup.backToLogin",
    translations.backToLogin ?? "로그인으로 돌아가기",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const payload: SignupRequestInsert = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      requested_role: requestedRole,
      requested_locale: locale,
      affiliation_text: affiliationText.trim() || null,
      region_text: regionText.trim() || null,
      generation_text: generationText.trim() || null,
      ministry_position: ministryPosition || null,
      self_introduction: selfIntroduction.trim() || null,
    };

    const signupRequestsTable = supabase
      .from("signup_requests") as unknown as SignupRequestsInsertTable;
    const { error } = await signupRequestsTable.insert(payload);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(
        error.code === UNIQUE_VIOLATION_CODE ? duplicatePendingText : errorText,
      );
      return;
    }

    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <>
        <h1 className="mt-6 text-3xl font-semibold">{titleText}</h1>
        <p className="mt-4 leading-7 text-ink-muted">{successText}</p>
        <a
          className="mt-8 inline-block text-sm font-medium text-brand-600 underline"
          href="/login"
        >
          {backToLoginText}
        </a>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-3xl font-semibold">{titleText}</h1>
      <p className="mt-4 leading-7 text-ink-muted">{descriptionText}</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-ink-base" htmlFor="name">
            {nameText}
          </label>
          <input
            autoComplete="name"
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="name"
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-base" htmlFor="email">
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
          <span className="block text-sm font-medium text-ink-base">{roleText}</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SELF_SIGNUP_ROLES.map((role) => (
              <button
                className={`rounded-md border px-3 py-2 text-sm ${
                  requestedRole === role
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-line-base bg-surface-card text-ink-base"
                }`}
                key={role}
                onClick={() => setRequestedRole(role)}
                type="button"
              >
                {role === "coachee" ? roleCoacheeText : roleCoachText}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="affiliation_text"
          >
            소속 교회/기관 (선택)
          </label>
          <input
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="affiliation_text"
            onChange={(event) => setAffiliationText(event.target.value)}
            placeholder="예: OO선교회, OO교회"
            type="text"
            value={affiliationText}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="region_text"
          >
            거주 지역 (선택)
          </label>
          <input
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="region_text"
            onChange={(event) => setRegionText(event.target.value)}
            placeholder="예: 치앙라이, 태국"
            type="text"
            value={regionText}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="generation_text"
          >
            소속 기수 (선택)
          </label>
          <input
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="generation_text"
            onChange={(event) => setGenerationText(event.target.value)}
            placeholder="예: 3기"
            type="text"
            value={generationText}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="ministry_position"
          >
            소속 직분 (선택)
          </label>
          <select
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="ministry_position"
            onChange={(event) => setMinistryPosition(event.target.value)}
            value={ministryPosition}
          >
            <option value="">미지정</option>
            {MINISTRY_POSITION_OPTIONS.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="self_introduction"
          >
            한 줄 소개 (선택)
          </label>
          <input
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="self_introduction"
            onChange={(event) => setSelfIntroduction(event.target.value)}
            placeholder="나를 한 문장으로 소개해 보세요"
            type="text"
            value={selfIntroduction}
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
          {isSubmitting ? `${submittingText}` : submitText}
        </button>

        <a
          className="block text-center text-sm font-medium text-brand-600 underline"
          href="/login"
        >
          {backToLoginText}
        </a>
      </form>
    </>
  );
}
