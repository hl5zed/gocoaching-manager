import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getProfile } from "@/lib/profile/getProfile";
import { ProfileForm, type ProfileTranslations } from "./ProfileForm";

export const dynamic = "force-dynamic";

type I18nResponse =
  | {
      ok: true;
      data: Record<string, string>;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

const defaultCommonTranslations = {
  save: "저장",
  cancel: "취소",
  loading: "불러오는 중",
  error: "오류",
  language: "언어",
  timezone: "시간대",
  back: "뒤로",
};

const defaultProfileTranslations = {
  title: "내 프로필",
  edit_profile: "프로필 수정",
  display_name: "표시 이름",
  phone: "전화번호",
  email_readonly: "이메일 (읽기 전용)",
  primary_role_readonly: "기본 역할 (읽기 전용)",
  status_readonly: "상태 (읽기 전용)",
  preferred_language: "선호 언어",
  timezone: "시간대",
  save_profile: "프로필 저장",
  profile_saved: "프로필이 저장되었습니다",
  profile_save_failed: "프로필 저장에 실패했습니다",
  invalid_language: "지원하지 않는 언어입니다",
  disallowed_fields: "수정할 수 없는 필드가 포함되어 있습니다",
};

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : "";
}

async function fetchI18nNamespace(
  origin: string,
  language: string,
  namespace: string,
) {
  if (!origin) {
    return {};
  }

  const response = await fetch(
    `${origin}/api/i18n/${language}/${namespace}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {};
  }

  const result = (await response.json()) as I18nResponse;
  return result.ok ? result.data : {};
}

export default async function ProfilePage() {
  await requireAuth();

  const result = await getProfile();

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login");
  }

  const language = result.data?.profile.preferred_language ?? "ko";
  const origin = await getOrigin();
  const [commonTranslations, profileTranslations] = await Promise.all([
    fetchI18nNamespace(origin, language, "common"),
    fetchI18nNamespace(origin, language, "profile"),
  ]);

  const translations: ProfileTranslations = {
    common: {
      ...defaultCommonTranslations,
      ...commonTranslations,
    },
    profile: {
      ...defaultProfileTranslations,
      ...profileTranslations,
    },
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Profile
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          {translations.profile.title}
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          {translations.profile.edit_profile}
        </p>

        <div className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          {result.error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {result.error.message}
            </p>
          ) : (
            <ProfileForm
              profile={result.data.profile}
              translations={translations}
            />
          )}
        </div>
      </section>
    </main>
  );
}
