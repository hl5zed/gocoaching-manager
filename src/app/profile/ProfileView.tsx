import Link from "next/link";
import type { ReactNode } from "react";
import type { MyProfileResult } from "@/lib/api/profile/me";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

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

function formatGeneration(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${value}세대`
    : null;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "suspended":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "archived":
    case "anonymized":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-line-base bg-surface-sunken text-ink-base";
  }
}

function initials(name: string | null) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </dt>
      <dd className="break-words text-sm text-ink-strong">{children}</dd>
    </div>
  );
}

export type ProfileViewProps = {
  result: MyProfileResult;
  backHref: string;
  backLabel: string;
  editHref: string;
};

export function ProfileView({
  result,
  backHref,
  backLabel,
  editHref,
}: ProfileViewProps) {
  return (
    <div className="px-2 py-4 text-ink-strong">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-widest text-ink-faint">
          프로필
        </p>
        <h1 className="mt-2 text-2xl font-semibold">내 프로필</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          초대 수락 때 입력한 프로필 정보를 확인할 수 있습니다.
        </p>

        <div className="mt-4 flex items-center justify-between border-b border-line-soft pb-4">
          <Link
            className="flex items-center gap-1 text-sm text-brand-600"
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
            {backLabel}
          </Link>
          <Link
            className="flex items-center gap-1.5 rounded-control border border-line-base bg-surface-card px-3 py-1.5 text-sm font-medium text-ink-base hover:bg-surface-sunken"
            href={editHref}
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            프로필 수정
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
          <div className="mt-6 space-y-4">
            {/* 기본 정보 + 상태 헤더 */}
            <section className="rounded-card border border-line-base bg-surface-card p-5">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
                >
                  {initials(result.data.profile.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-strong">
                    {displayValue(result.data.profile.full_name)}
                  </p>
                  <p className="truncate text-sm text-ink-muted">
                    {result.data.authEmail ?? ""}
                  </p>
                </div>
                <span
                  className={`inline-flex flex-shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(result.data.profile.status)}`}
                >
                  {getStatusLabel(result.data.profile.status)}
                </span>
              </div>

              <div className="mt-4 border-t border-line-soft pt-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="표시 이름">
                    {displayValue(result.data.profile.display_name)}
                  </Field>
                  <Field label="전화번호">
                    {displayValue(result.data.profile.phone)}
                  </Field>
                  <Field label="시간대">
                    {displayValue(result.data.profile.timezone)}
                  </Field>
                  <Field label="대표 역할">
                    {result.data.profile.primary_role
                      ? getRoleLabel(result.data.profile.primary_role)
                      : "미지정"}
                  </Field>
                </dl>
              </div>
            </section>

            {/* 소속 정보 */}
            <section className="rounded-card border border-line-base bg-surface-card p-5">
              <h2 className="mb-4 border-b border-line-soft pb-3 text-sm font-semibold text-ink-strong">
                소속 정보
              </h2>
              <dl className="grid gap-4 sm:grid-cols-3">
                <Field label="기관 및 단체">
                  {formatLookupValue(
                    result.data.profile.organization_name,
                    result.data.profile.organization_id,
                  )}
                </Field>
                <Field label="국가">
                  {formatCountry(
                    result.data.profile.country_name,
                    result.data.profile.country_code,
                    result.data.profile.country_id,
                  )}
                </Field>
                <Field label="교회">
                  {formatLookupValue(
                    result.data.profile.church_name,
                    result.data.profile.church_id,
                  )}
                </Field>
                <Field label="직분">
                  {displayValue(result.data.profile.ministry_position)}
                </Field>
                {formatGeneration(result.data.profile.generation_number) && (
                  <Field label="세대">
                    {formatGeneration(result.data.profile.generation_number)}
                  </Field>
                )}
              </dl>
            </section>

            {/* 활성 역할 */}
            <section className="rounded-card border border-line-base bg-surface-card p-5">
              <h2 className="mb-3 border-b border-line-soft pb-3 text-sm font-semibold text-ink-strong">
                활성 역할
              </h2>
              {result.data.roles.length > 0 ? (
                <div className="divide-y divide-line-soft">
                  {result.data.roles.map((role) => (
                    <div
                      className="flex items-center gap-3 py-2.5 text-sm"
                      key={`${role.role}-${role.scope_type}-${role.scope_id ?? "global"}`}
                    >
                      <span className="inline-flex rounded-full border border-line-base bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-ink-base">
                        {getRoleLabel(role.role)}
                      </span>
                      <span className="flex-1 text-ink-base">
                        {formatScope(role.scope_type, role.scope_id)}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {getStatusLabel(role.status)}
                      </span>
                      <span className="w-36 text-right text-xs text-ink-faint">
                        {formatDateTime(role.assigned_at) ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">활성 역할이 없습니다.</p>
              )}
            </section>

            {/* 메타 정보 */}
            <div className="flex flex-wrap gap-4 px-1 text-xs text-ink-faint">
              {formatDateTime(result.data.profile.created_at) && (
                <span>가입일 {formatDateTime(result.data.profile.created_at)}</span>
              )}
              {formatDateTime(result.data.profile.updated_at) && (
                <span>
                  최근 수정 {formatDateTime(result.data.profile.updated_at)}
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
