import Link from "next/link";
import { notFound } from "next/navigation";
import { ResendInvitationButton } from "@/components/admin/ResendInvitationButton";
import { RevokeInvitationButton } from "@/components/admin/RevokeInvitationButton";
import {
  getAdminInvitationDetail,
  type AdminInvitationDetail,
} from "@/lib/api/admin/invitation-detail";
import { type InvitationStatus } from "@/types/database";
import {
  formatScope as formatScopeLabel,
  getRoleLabel,
  getStatusLabel,
} from "@/lib/ui/labels";


type SearchParams = Record<string, string | string[] | undefined>;

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
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
    timeZone: "Asia/Seoul",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
    "minute",
  )}`;
}

function invitationStatusBadgeClass(status: InvitationStatus) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "expired":
      return "border-line-base bg-surface-sunken text-ink-base";
    case "revoked":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-line-base bg-surface-sunken text-ink-base";
  }
}

function shortenScopeId(scopeId: string | null) {
  if (!scopeId) {
    return "";
  }

  if (scopeId.length <= 12) {
    return scopeId;
  }

  return `${scopeId.slice(0, 8)}...${scopeId.slice(-4)}`;
}

function formatScope(invitation: AdminInvitationDetail) {
  return formatScopeLabel(invitation.scope_type, invitation.scope_id);
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

function isExpired(invitation: AdminInvitationDetail) {
  return new Date(invitation.expires_at).getTime() <= Date.now();
}

function isAccepted(invitation: AdminInvitationDetail) {
  return invitation.accepted_at !== null || invitation.status === "accepted";
}

function isRevoked(invitation: AdminInvitationDetail) {
  return invitation.status === "revoked";
}

function isRevokableInvitation(invitation: AdminInvitationDetail) {
  return (
    invitation.status === "pending" &&
    invitation.accepted_at === null &&
    new Date(invitation.expires_at).getTime() > Date.now()
  );
}

function isRegeneratableInvitation(invitation: AdminInvitationDetail) {
  return (
    invitation.accepted_at === null &&
    (invitation.status === "pending" || invitation.status === "expired")
  );
}

function getSingleQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatInviter(invitation: AdminInvitationDetail) {
  if (!invitation.inviter) {
    return shortenUuid(invitation.invited_by);
  }

  const primary =
    invitation.inviter.display_name ||
    invitation.inviter.full_name ||
    invitation.inviter.email;

  return primary && primary.trim().length > 0
    ? primary
    : shortenUuid(invitation.invited_by);
}

export default async function AdminInvitationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : {};
  const from = getSingleQueryValue(resolvedSearchParams.from);
  const detail = await getAdminInvitationDetail(resolvedParams.id);

  if (detail.kind === "not_found") {
    notFound();
  }

  if (detail.kind === "error") {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <section className="mx-auto w-full max-w-4xl">
          <div className="rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 초대를 불러올 수 없습니다.
          </div>
        </section>
      </main>
    );
  }

  const invitation = detail.invitation;
  const backHref = from.length > 0 ? from : "/admin/invitations";

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
          관리자
        </p>
        <h1 className="mt-3 text-3xl font-semibold">초대 상세</h1>
        <p className="mt-4 max-w-3xl leading-7 text-ink-muted">
          하나의 초대를 읽기 전용으로 확인할 수 있습니다.
        </p>

        <div className="mt-6 grid gap-6">
          <section className="rounded-card border border-line-base bg-surface-card p-6">
            <h2 className="text-lg font-semibold">초대 요약</h2>
            <dl className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-ink-faint">이메일</dt>
                <dd className="mt-1">{invitation.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">역할</dt>
                <dd className="mt-1">
                  <span className="inline-flex rounded-full border border-line-base bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-base">
                    {getRoleLabel(invitation.invited_role)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">범위</dt>
                <dd className="mt-1">{formatScope(invitation)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">상태</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${invitationStatusBadgeClass(
                      invitation.status,
                    )}`}
                  >
                    {getStatusLabel(invitation.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">생성일</dt>
                <dd className="mt-1">{formatDateTime(invitation.created_at)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">수정일</dt>
                <dd className="mt-1">{formatDateTime(invitation.updated_at)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-card border border-line-base bg-surface-card p-6">
            <h2 className="text-lg font-semibold">수락 상태</h2>
            <dl className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-ink-faint">만료일</dt>
                <dd className="mt-1">{formatDateTime(invitation.expires_at)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">수락일</dt>
                <dd className="mt-1">{formatDateTime(invitation.accepted_at)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">만료 여부</dt>
                <dd className="mt-1">{isExpired(invitation) ? "예" : "아니오"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">수락 여부</dt>
                <dd className="mt-1">{isAccepted(invitation) ? "예" : "아니오"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">철회 여부</dt>
                <dd className="mt-1">{isRevoked(invitation) ? "예" : "아니오"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-card border border-line-base bg-surface-card p-6">
            <h2 className="text-lg font-semibold">관리자 정보</h2>
            <dl className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-ink-faint">초대한 사람</dt>
                <dd className="mt-1">{formatInviter(invitation)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-faint">초대한 사람 ID</dt>
                <dd className="mt-1">{shortenUuid(invitation.invited_by)}</dd>
              </div>
              {invitation.inviter?.email && (
                <div>
                  <dt className="text-sm font-medium text-ink-faint">초대한 사람 이메일</dt>
                  <dd className="mt-1">{invitation.inviter.email}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-card border border-line-base bg-surface-card p-6">
            <h2 className="text-lg font-semibold">안전한 작업</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                className="rounded-control border border-line-base px-4 py-2 font-medium text-ink-base"
                href={backHref}
              >
                초대 목록으로 돌아가기
              </Link>
              {isRegeneratableInvitation(invitation) && (
                <ResendInvitationButton invitationId={invitation.id} />
              )}
              {isRevokableInvitation(invitation) && (
                <RevokeInvitationButton invitationId={invitation.id} />
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
