import Link from "next/link";
import type { ReactNode } from "react";
import type { MyProfileResult } from "@/lib/api/profile/me";
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from "@/lib/timezone";
import { getRoleLabel } from "@/lib/ui/labels";

function displayValue(value: string | null): string {
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
  if (name && name.trim().length > 0) return name;
  return id ? `ID: ${id.slice(0, 8)}...` : "미지정";
}

function ReadOnlyField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-control border border-line-base bg-surface-app p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">{children}</p>
    </div>
  );
}

export type ProfileEditViewProps = {
  result: MyProfileResult;
  errorMessage: string;
  action: (formData: FormData) => void | Promise<void>;
  backHref: string;
  cancelHref: string;
};

export function ProfileEditView({
  result,
  errorMessage,
  action,
  backHref,
  cancelHref,
}: ProfileEditViewProps) {
  return (
    <div className="px-2 py-4 text-ink-strong">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-widest text-ink-faint">
          프로필
        </p>
        <h1 className="mt-2 text-2xl font-semibold">프로필 수정</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          표시 이름, 전화번호, 소속 직분, 시간대를 직접 수정할 수 있습니다.
        </p>

        <div className="mt-4 border-b border-line-soft pb-4">
          <Link
            className="flex w-fit items-center gap-1 text-sm text-brand-600"
            href={backHref}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M19 12H5M12 5l-7 7 7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            내 프로필로
          </Link>
        </div>

        {!result.ok ? (
          <div className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 프로필을 불러올 수 없습니다.
          </div>
        ) : result.data.profile === null ? (
          <div className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
            <p className="text-ink-base">아직 프로필이 생성되지 않았습니다.</p>
            <p className="mt-2 text-sm text-ink-muted">
              초대를 받으셨다면 먼저 초대를 수락해 주세요.
            </p>
          </div>
        ) : (
          <form action={action} className="mt-6 space-y-4">
            {errorMessage && (
              <div className="rounded-control border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            <div className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              소속·역할·세대·회원 상태는 관리자만 변경할 수 있습니다.
            </div>

            {/* 기본 정보 */}
            <section className="rounded-card border border-line-base bg-surface-card p-5">
              <h2 className="mb-4 border-b border-line-soft pb-3 text-sm font-semibold">
                기본 정보
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyField label="이름 (읽기 전용)">
                  {displayValue(result.data.profile.full_name)}
                </ReadOnlyField>
                <ReadOnlyField label="이메일 (읽기 전용)">
                  {displayValue(result.data.profile.email)}
                </ReadOnlyField>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-sm font-medium text-ink-base"
                    htmlFor="display_name"
                  >
                    표시 이름
                  </label>
                  <input
                    className="w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-strong outline-none focus:border-brand-600"
                    defaultValue={result.data.profile.display_name ?? ""}
                    id="display_name"
                    maxLength={120}
                    name="display_name"
                    type="text"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-sm font-medium text-ink-base"
                    htmlFor="phone"
                  >
                    전화번호
                  </label>
                  <input
                    className="w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-strong outline-none focus:border-brand-600"
                    defaultValue={result.data.profile.phone ?? ""}
                    id="phone"
                    maxLength={50}
                    name="phone"
                    type="tel"
                  />
                </div>
              </div>
            </section>

            {/* 소속 정보 */}
            <section className="rounded-card border border-line-base bg-surface-card p-5">
              <h2 className="mb-4 border-b border-line-soft pb-3 text-sm font-semibold">
                소속 정보
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <ReadOnlyField label="기관 및 단체 (읽기 전용)">
                  {formatLookupValue(
                    result.data.profile.organization_name,
                    result.data.profile.organization_id,
                  )}
                </ReadOnlyField>
                <ReadOnlyField label="국가 (읽기 전용)">
                  {formatCountry(
                    result.data.profile.country_name,
                    result.data.profile.country_code,
                    result.data.profile.country_id,
                  )}
                </ReadOnlyField>
                <ReadOnlyField label="교회 (읽기 전용)">
                  {formatLookupValue(
                    result.data.profile.church_name,
                    result.data.profile.church_id,
                  )}
                </ReadOnlyField>
              </div>
              <div className="mt-3 sm:w-1/2">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-sm font-medium text-ink-base"
                    htmlFor="ministry_position"
                  >
                    소속 직분
                  </label>
                  <input
                    className="w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-strong outline-none focus:border-brand-600"
                    defaultValue={result.data.profile.ministry_position ?? ""}
                    id="ministry_position"
                    maxLength={100}
                    name="ministry_position"
                    placeholder="예: 목회자, 선교사, 장로, 집사"
                    type="text"
                  />
                </div>
              </div>
            </section>

            {/* 시간대 */}
            <section className="rounded-card border border-line-base bg-surface-card p-5">
              <h2 className="mb-4 border-b border-line-soft pb-3 text-sm font-semibold">
                시간대
              </h2>
              <div className="sm:w-1/2">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-sm font-medium text-ink-base"
                    htmlFor="timezone"
                  >
                    개인 시간대
                  </label>
                  <select
                    className="w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-strong outline-none focus:border-brand-600"
                    defaultValue={
                      result.data.profile.timezone ?? DEFAULT_TIMEZONE
                    }
                    id="timezone"
                    name="timezone"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-5 text-ink-muted">
                    하루 기록·주간 기록·월간 회고·보고서 기준 날짜 계산에
                    적용됩니다.
                  </p>
                </div>
              </div>
            </section>

            {/* 역할 (읽기 전용 요약) */}
            {(result.data.profile.primary_role ||
              result.data.roles.length > 0) && (
              <section className="rounded-card border border-line-base bg-surface-card p-5">
                <h2 className="mb-4 border-b border-line-soft pb-3 text-sm font-semibold">
                  역할 및 세대
                  <span className="ml-2 text-xs font-normal text-ink-faint">
                    (읽기 전용)
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {result.data.roles.length > 0 ? (
                    result.data.roles.map((role) => (
                      <span
                        className="inline-flex rounded-full border border-line-base bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-base"
                        key={`${role.role}-${role.scope_type}-${role.scope_id ?? "global"}`}
                      >
                        {getRoleLabel(role.role)}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-ink-muted">
                      활성 역할이 없습니다.
                    </p>
                  )}
                </div>
              </section>
            )}

            <div className="flex items-center gap-3 pb-4">
              <button
                className="rounded-control bg-navy-900 px-5 py-2.5 text-sm font-medium text-white"
                type="submit"
              >
                저장
              </button>
              <Link
                className="rounded-control border border-line-base px-5 py-2.5 text-sm font-medium text-ink-base"
                href={cancelHref}
              >
                취소
              </Link>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
