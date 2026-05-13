import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/getSession";
import { getMyProfile } from "@/lib/api/profile/me";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) {
    return "미지정";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "미지정";
  }

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
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
    "minute",
  )}`;
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

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "inactive":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "suspended":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "archived":
      return "border-slate-300 bg-slate-50 text-slate-600";
    case "anonymized":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-950">{value}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fprofile");
  }

  const result = await getMyProfile();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fprofile");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          프로필
        </p>
        <h1 className="mt-3 text-3xl font-semibold">내 프로필</h1>
        <p className="mt-4 leading-7 text-slate-600">
          회원가입과 초대 수락 때 입력한 본인 프로필 정보를 확인할 수 있습니다.
        </p>

        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              className="text-sm font-medium text-slate-700 underline"
              href="/dashboard"
            >
              대시보드로 돌아가기
            </Link>
            <Link
              className="text-sm font-medium text-slate-700 underline"
              href="/profile/edit"
            >
              프로필 수정
            </Link>
          </div>
        </div>

        {!result.ok ? (
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 프로필을 불러올 수 없습니다.
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <section className="rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">계정</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    로그인 이메일
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(result.data.authEmail)}
                  </dd>
                </div>
              </dl>
            </section>

            {result.data.profile === null ? (
              <section className="rounded-md border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold">프로필</h2>
                <p className="mt-4 text-slate-700">
                  아직 프로필이 생성되지 않았습니다.
                </p>
                {result.data.authEmail && (
                  <p className="mt-2 text-slate-600">
                    현재 계정 이메일: {result.data.authEmail}
                  </p>
                )}
                <p className="mt-3 text-slate-600">
                  초대를 받으셨다면 먼저 초대를 수락해 주세요.
                </p>
              </section>
            ) : (
              <>
                <section className="rounded-md border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold">기본 정보</h2>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <DetailItem
                      label="이름"
                      value={displayValue(result.data.profile.full_name)}
                    />
                    <DetailItem
                      label="표시 이름"
                      value={displayValue(result.data.profile.display_name)}
                    />
                    <DetailItem
                      label="이메일"
                      value={displayValue(result.data.profile.email)}
                    />
                    <DetailItem
                      label="전화번호"
                      value={displayValue(result.data.profile.phone)}
                    />
                  </dl>
                </section>

                <section className="rounded-md border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold">소속 정보</h2>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <DetailItem
                      label="소속 기관 및 단체"
                      value={formatLookupValue(
                        result.data.profile.organization_name,
                        result.data.profile.organization_id,
                      )}
                    />
                    <DetailItem
                      label="소속 국가"
                      value={formatCountry(
                        result.data.profile.country_name,
                        result.data.profile.country_code,
                        result.data.profile.country_id,
                      )}
                    />
                    <DetailItem
                      label="소속 교회"
                      value={formatLookupValue(
                        result.data.profile.church_name,
                        result.data.profile.church_id,
                      )}
                    />
                    <DetailItem
                      label="소속 직분"
                      value={displayValue(result.data.profile.ministry_position)}
                    />
                  </dl>
                </section>

                <section className="rounded-md border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold">역할 및 세대</h2>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <DetailItem
                      label="대표 시스템 역할"
                      value={
                        result.data.profile.primary_role
                          ? getRoleLabel(result.data.profile.primary_role)
                          : "미지정"
                      }
                    />
                    <DetailItem
                      label="세대"
                      value={formatGeneration(
                        result.data.profile.generation_number,
                      )}
                    />
                  </dl>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-slate-700">
                      활성 시스템 역할
                    </h3>
                    {result.data.roles.length > 0 ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-3 py-2 font-medium">역할</th>
                              <th className="px-3 py-2 font-medium">범위</th>
                              <th className="px-3 py-2 font-medium">상태</th>
                              <th className="px-3 py-2 font-medium">
                                배정일
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.data.roles.map((role) => (
                              <tr
                                className="border-b border-slate-100 text-slate-800"
                                key={`${role.role}-${role.scope_type}-${role.scope_id ?? "global"}`}
                              >
                                <td className="px-3 py-3">
                                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                    {getRoleLabel(role.role)}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  {formatScope(role.scope_type, role.scope_id)}
                                </td>
                                <td className="px-3 py-3">
                                  {getStatusLabel(role.status)}
                                </td>
                                <td className="px-3 py-3">
                                  {formatDateTime(role.assigned_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-4 text-slate-600">
                        활성 역할이 없습니다.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold">시스템 자동 기록</h2>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-slate-500">
                        회원 상태
                      </dt>
                      <dd className="mt-1">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                            result.data.profile.status,
                          )}`}
                        >
                          {getStatusLabel(result.data.profile.status)}
                        </span>
                      </dd>
                    </div>
                    <DetailItem
                      label="가입일"
                      value={formatDateTime(result.data.profile.created_at)}
                    />
                    <DetailItem
                      label="최근 수정일"
                      value={formatDateTime(result.data.profile.updated_at)}
                    />
                  </dl>
                </section>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
