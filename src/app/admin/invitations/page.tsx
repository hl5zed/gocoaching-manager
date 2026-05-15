import Link from "next/link";
import { ResendInvitationButton } from "@/components/admin/ResendInvitationButton";
import { RevokeInvitationButton } from "@/components/admin/RevokeInvitationButton";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import {
  getAdminInvitations,
  normalizeAdminInvitationsPage,
  normalizeAdminInvitationRole,
  normalizeAdminInvitationSearch,
  normalizeAdminInvitationStatus,
  type AdminInvitationSummary,
} from "@/lib/api/admin/invitations";
import { INVITATION_STATUSES, USER_ROLES } from "@/types/database";
import {
  formatScope,
  getRoleLabel,
  getStatusLabel,
} from "@/lib/ui/labels";

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

function shortenUuid(value: string | null) {
  if (!value) {
    return "—";
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
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
  return query.length > 0
    ? `/admin/invitations?${query}`
    : "/admin/invitations";
}

function getDetailHref(invitationId: string, from: string) {
  const params = new URLSearchParams();

  if (from.length > 0) {
    params.set("from", from);
  }

  const query = params.toString();
  return query.length > 0
    ? `/admin/invitations/${invitationId}?${query}`
    : `/admin/invitations/${invitationId}`;
}

function isRevokableInvitation(invitation: AdminInvitationSummary) {
  return (
    invitation.status === "pending" &&
    invitation.accepted_at === null &&
    new Date(invitation.expires_at).getTime() > Date.now()
  );
}

function isRegeneratableInvitation(invitation: AdminInvitationSummary) {
  return (
    invitation.accepted_at === null &&
    (invitation.status === "pending" || invitation.status === "expired")
  );
}

function invitationStatusBadgeClass(status: AdminInvitationSummary["status"]) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "expired":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "revoked":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : {};
  const q = normalizeAdminInvitationSearch(resolvedSearchParams.q);
  const role = normalizeAdminInvitationRole(resolvedSearchParams.role);
  const status = normalizeAdminInvitationStatus(resolvedSearchParams.status);
  const page = normalizeAdminInvitationsPage(resolvedSearchParams.page);
  const { invitations, error, hasNext } = await getAdminInvitations({
    q,
    role,
    status,
    page,
    limit: 50,
  });
  const currentListHref = getPageHref({ q, role, status, page });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              관리자
            </p>
            <h1 className="mt-3 text-3xl font-semibold">초대</h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              초대와 현재 상태를 읽기 전용으로 확인할 수 있습니다.
            </p>
            <PageNavigationButtons
              className="mt-4 min-w-0 justify-start"
              dashboardHref="/admin"
            />
          </div>

          <Link
            className="rounded-md bg-slate-950 px-4 py-2 font-medium text-white"
            href="/admin/invitations/new"
          >
            초대 생성
          </Link>
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
                placeholder="이메일"
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
                {INVITATION_STATUSES.map((invitationStatus) => (
                  <option key={invitationStatus} value={invitationStatus}>
                    {getStatusLabel(invitationStatus)}
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
            지금 초대를 불러올 수 없습니다.
          </div>
        )}

        {!error && invitations.length === 0 && (
          <div className="mt-6 rounded-md border border-slate-200 bg-white p-6 text-slate-600">
            초대가 없습니다.
          </div>
        )}

        {!error && invitations.length > 0 && (
          <>
            <div className="mt-6 overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-3 font-medium">이메일</th>
                    <th className="px-4 py-3 font-medium">역할</th>
                    <th className="px-4 py-3 font-medium">범위</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium">만료일</th>
                    <th className="px-4 py-3 font-medium">수락일</th>
                    <th className="px-4 py-3 font-medium">생성일</th>
                    <th className="px-4 py-3 font-medium">초대한 사람</th>
                    <th className="px-4 py-3 font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invitation) => (
                    <tr
                      className="border-b border-slate-100 text-slate-800"
                      key={invitation.id}
                    >
                      <td className="px-4 py-3">
                        <Link
                          className="font-medium text-slate-900 underline"
                          href={getDetailHref(invitation.id, currentListHref)}
                        >
                          {invitation.email}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {getRoleLabel(invitation.invited_role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {formatScope(invitation.scope_type, invitation.scope_id)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${invitationStatusBadgeClass(
                            invitation.status,
                          )}`}
                        >
                          {getStatusLabel(invitation.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(invitation.expires_at)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(invitation.accepted_at)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(invitation.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {shortenUuid(invitation.invited_by)}
                      </td>
                      <td className="px-4 py-3">
                        {isRegeneratableInvitation(invitation) ? (
                          <div className="flex flex-wrap gap-2">
                            <ResendInvitationButton invitationId={invitation.id} />
                            {isRevokableInvitation(invitation) && (
                              <RevokeInvitationButton invitationId={invitation.id} />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
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
