import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/getSession";
import { getMyProfile } from "@/lib/api/profile/me";
import { updateMyProfile } from "@/lib/api/profile/update-me";
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from "@/lib/timezone";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";


function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "미지정";
}

function formatCountry(
  name: string | null,
  code: string | null,
  id: string | null,
) {
  if (name && name.trim().length > 0) {
    return code && code.trim().length > 0 ? `${name} (${code})` : name;
  }

  return id ? `ID: ${id.slice(0, 8)}...` : "미지정";
}

function formatLookupValue(name: string | null, id: string | null) {
  if (name && name.trim().length > 0) {
    return name;
  }

  return id ? `ID: ${id.slice(0, 8)}...` : "미지정";
}

function formatGeneration(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${value}세대`
    : "미지정";
}

function ReadOnlyItem({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-card border border-line-base bg-surface-app p-4">
      <dt className="text-sm font-medium text-ink-faint">{label}</dt>
      <dd className="mt-1 break-words text-ink-strong">{value}</dd>
      {note && <p className="mt-2 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fprofile%2Fedit");
  }

  const result = await getMyProfile();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fprofile%2Fedit");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  async function saveProfile(formData: FormData) {
    "use server";

    const updateResult = await updateMyProfile({
      display_name: formData.get("display_name"),
      phone: formData.get("phone"),
      ministry_position: formData.get("ministry_position"),
      timezone: formData.get("timezone"),
    });

    if (!updateResult.ok) {
      const nextError = encodeURIComponent(updateResult.error.message);
      redirect(`/profile/edit?error=${nextError}`);
    }

    redirect("/profile");
  }

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
          프로필
        </p>
        <h1 className="mt-3 text-3xl font-semibold">프로필 수정</h1>
        <p className="mt-4 leading-7 text-ink-muted">
          표시 이름, 전화번호, 소속 직분, 개인 시간대를 직접 수정할 수 있습니다.
          소속/역할/세대 정보 변경은 관리자에게 요청해 주세요.
        </p>

        <div className="mt-6">
          <Link
            className="text-sm font-medium text-brand-600 underline"
            href="/profile"
          >
            프로필로 돌아가기
          </Link>
        </div>

        {!result.ok ? (
          <div className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 프로필을 불러올 수 없습니다.
          </div>
        ) : result.data.profile === null ? (
          <div className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
            <h2 className="text-lg font-semibold">프로필</h2>
            <p className="mt-4 text-ink-base">
              아직 프로필이 생성되지 않았습니다.
            </p>
            <div className="mt-4">
              <Link
                className="text-sm font-medium text-brand-600 underline"
                href="/profile"
              >
                프로필로 돌아가기
              </Link>
            </div>
          </div>
        ) : (
          <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
            {errorMessage && (
              <div className="mb-5 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
                {errorMessage}
              </div>
            )}

            <form action={saveProfile} className="space-y-5">
              <div className="rounded-control border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                이메일, 시스템 역할, 소속 국가, 소속 기관 및 단체, 소속
                교회, 세대, 회원 상태는 직접 수정할 수 없습니다. 변경이
                필요하면 관리자에게 요청해 주세요.
              </div>

              <section className="space-y-4">
                <h2 className="text-lg font-semibold">기본 정보</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <ReadOnlyItem
                    label="이름"
                    value={displayValue(result.data.profile.full_name)}
                  />
                  <ReadOnlyItem
                    label="이메일"
                    note="이 항목은 관리자 승인 후 변경됩니다."
                    value={displayValue(result.data.profile.email)}
                  />
                </dl>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="block text-sm font-medium text-ink-base"
                      htmlFor="display_name"
                    >
                      표시 이름
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                      defaultValue={result.data.profile.display_name ?? ""}
                      id="display_name"
                      maxLength={120}
                      name="display_name"
                      type="text"
                    />
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-ink-base"
                      htmlFor="phone"
                    >
                      전화번호
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                      defaultValue={result.data.profile.phone ?? ""}
                      id="phone"
                      maxLength={50}
                      name="phone"
                      type="tel"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t border-line-soft pt-5">
                <h2 className="text-lg font-semibold">소속 정보</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <ReadOnlyItem
                    label="소속 기관 및 단체"
                    note="소속/역할/세대 정보 변경은 관리자에게 요청해 주세요."
                    value={formatLookupValue(
                      result.data.profile.organization_name,
                      result.data.profile.organization_id,
                    )}
                  />
                  <ReadOnlyItem
                    label="소속 국가"
                    note="소속/역할/세대 정보 변경은 관리자에게 요청해 주세요."
                    value={formatCountry(
                      result.data.profile.country_name,
                      result.data.profile.country_code,
                      result.data.profile.country_id,
                    )}
                  />
                  <ReadOnlyItem
                    label="소속 교회"
                    note="소속/역할/세대 정보 변경은 관리자에게 요청해 주세요."
                    value={formatLookupValue(
                      result.data.profile.church_name,
                      result.data.profile.church_id,
                    )}
                  />
                </dl>

                <div>
                  <label
                    className="block text-sm font-medium text-ink-base"
                    htmlFor="ministry_position"
                  >
                    소속 직분
                  </label>
                  <input
                    className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                    defaultValue={result.data.profile.ministry_position ?? ""}
                    id="ministry_position"
                    maxLength={100}
                    name="ministry_position"
                    placeholder="예: 목회자, 선교사, 장로, 집사"
                    type="text"
                  />
                </div>
              </section>

              <section className="space-y-4 border-t border-line-soft pt-5">
                <h2 className="text-lg font-semibold">시간대 설정</h2>
                <div>
                  <label
                    className="block text-sm font-medium text-ink-base"
                    htmlFor="timezone"
                  >
                    개인 시간대
                  </label>
                  <select
                    className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                    defaultValue={result.data.profile.timezone ?? DEFAULT_TIMEZONE}
                    id="timezone"
                    name="timezone"
                  >
                    {TIMEZONE_OPTIONS.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    개인 시간대는 하루 기록, 주간 기록, 월간 회고, 보고서
                    기준 날짜 계산에 우선 적용됩니다.
                  </p>
                </div>
              </section>

              <section className="space-y-4 border-t border-line-soft pt-5">
                <h2 className="text-lg font-semibold">역할 및 세대</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <ReadOnlyItem
                    label="대표 시스템 역할"
                    note="시스템 역할 변경은 관리자에게 요청해 주세요."
                    value={
                      result.data.profile.primary_role
                        ? getRoleLabel(result.data.profile.primary_role)
                        : "미지정"
                    }
                  />
                  <ReadOnlyItem
                    label="세대"
                    note="세대 정보 변경은 관리자에게 요청해 주세요."
                    value={formatGeneration(
                      result.data.profile.generation_number,
                    )}
                  />
                </dl>

                <div className="rounded-card border border-line-base bg-surface-app p-4">
                  <h3 className="text-sm font-medium text-ink-faint">
                    활성 시스템 역할
                  </h3>
                  {result.data.roles.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.data.roles.map((role) => (
                        <span
                          className="inline-flex rounded-full border border-line-base bg-surface-card px-2.5 py-1 text-xs font-medium text-ink-base"
                          key={`${role.role}-${role.scope_type}-${role.scope_id ?? "global"}`}
                          title={formatScope(role.scope_type, role.scope_id)}
                        >
                          {getRoleLabel(role.role)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-ink-muted">
                      활성 역할이 없습니다.
                    </p>
                  )}
                </div>
              </section>

              <section className="space-y-4 border-t border-line-soft pt-5">
                <h2 className="text-lg font-semibold">시스템 자동 기록</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <ReadOnlyItem
                    label="회원 상태"
                    note="회원 상태 변경은 관리자에게 요청해 주세요."
                    value={getStatusLabel(result.data.profile.status)}
                  />
                </dl>
              </section>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-control bg-navy-900 px-5 py-2.5 font-medium text-white"
                  type="submit"
                >
                  저장
                </button>
                <Link
                  className="rounded-control border border-line-base px-5 py-2.5 font-medium text-ink-base"
                  href="/profile"
                >
                  취소
                </Link>
              </div>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
