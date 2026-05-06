import Link from "next/link";
import {
  getAdminUsers,
  normalizeAdminUserRole,
  normalizeAdminUsersPage,
  normalizeAdminUserSearch,
  normalizeAdminUserStatus,
  type AdminUserSummary,
} from "@/lib/api/admin/users";
import { PROFILE_STATUSES, USER_ROLES } from "@/types/database";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
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

function formatName(user: AdminUserSummary) {
  const candidates = [user.display_name, user.full_name, user.email];

  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return "이름 없음";
}

function formatEmail(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function formatScopeSummary(roles: AdminUserSummary["roles"]) {
  if (roles.length === 0) {
    return "—";
  }

  return roles
    .map((role) => formatScope(role.scope_type, role.scope_id))
    .join(", ");
}

function getPageHref({
  q,
  role,
  status,
  page,
}: {
  q: string;
  role: string;
  status: string;
  page: number;
}) {
  const params = new URLSearchParams();

  if (q.length > 0) {
    params.set("q", q);
  }

  if (role !== "all") {
    params.set("role", role);
  }

  if (status !== "all") {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query.length > 0 ? `/admin/users?${query}` : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : {};
  const q = normalizeAdminUserSearch(resolvedSearchParams.q);
  const role = normalizeAdminUserRole(resolvedSearchParams.role);
  const status = normalizeAdminUserStatus(resolvedSearchParams.status);
  const page = normalizeAdminUsersPage(resolvedSearchParams.page);
  const { users, error, hasNext } = await getAdminUsers({
    q,
    role,
    status,
    page,
    limit: 50,
  });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              관리자
            </p>
            <h1 className="mt-3 text-3xl font-semibold">사용자 및 역할</h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              프로필과 활성 역할을 읽기 전용으로 조회할 수 있습니다.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              새 회원은 초대를 보내는 방식으로 추가합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              href="/admin/coaching-relationships/new"
            >
              코칭 관계 생성
            </Link>
            <Link
              className="inline-flex rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
              href="/admin/invitations/new"
            >
              회원 추가
            </Link>
          </div>
        </div>

        <form
          className="mt-6 rounded-md border border-slate-200 bg-white p-4"
          method="get"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">검색</span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={q}
                name="q"
                placeholder="이름 또는 이메일"
                type="text"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">역할</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={role}
                name="role"
              >
                <option value="all">전체</option>
                {USER_ROLES.map((userRole) => (
                  <option key={userRole} value={userRole}>
                    {getRoleLabel(userRole)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">상태</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={status}
                name="status"
              >
                <option value="all">전체</option>
                {PROFILE_STATUSES.map((profileStatus) => (
                  <option key={profileStatus} value={profileStatus}>
                    {getStatusLabel(profileStatus)}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="rounded-md bg-slate-950 px-4 py-2 font-medium text-white"
              type="submit"
            >
              필터
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 사용자를 불러올 수 없습니다.
          </div>
        )}

        {!error && users.length === 0 && (
          <div className="mt-6 rounded-md border border-slate-200 bg-white p-6 text-slate-600">
            사용자가 없습니다.
          </div>
        )}

        {!error && users.length > 0 && (
          <>
            <div className="mt-6 overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-3 font-medium">이름</th>
                    <th className="px-4 py-3 font-medium">이메일</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium">역할</th>
                    <th className="px-4 py-3 font-medium">범위</th>
                    <th className="px-4 py-3 font-medium">생성일</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      className="border-b border-slate-100 text-slate-800"
                      key={user.id}
                    >
                      <td className="px-4 py-3">{formatName(user)}</td>
                      <td className="px-4 py-3">{formatEmail(user.email)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                            user.status === "active"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : user.status === "inactive"
                                ? "border-slate-200 bg-slate-100 text-slate-700"
                                : user.status === "suspended"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : user.status === "archived"
                                    ? "border-violet-200 bg-violet-50 text-violet-700"
                                    : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {getStatusLabel(user.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.roles.length === 0 ? (
                          <span className="text-slate-500">활성 역할 없음</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {user.roles.map((roleItem) => (
                              <span
                                className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                key={roleItem.id}
                              >
                                {getRoleLabel(roleItem.role)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatScopeSummary(user.roles)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm text-slate-600">{page}페이지</p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    href={getPageHref({ q, role, status, page: page - 1 })}
                  >
                    이전
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-400">
                    이전
                  </span>
                )}

                {hasNext ? (
                  <Link
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    href={getPageHref({ q, role, status, page: page + 1 })}
                  >
                    다음
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-400">
                    다음
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
