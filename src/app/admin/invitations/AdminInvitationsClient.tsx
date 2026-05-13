"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  SCOPE_TYPES,
  USER_ROLES,
  type InvitationStatus,
  type ScopeType,
  type UserRole,
} from "@/types/database";
import {
  isNonEmptyString,
  isValidEmail,
  isValidNumberInRange,
  isValidUuid,
  normalizeText,
} from "@/lib/validation/common";

const roleOptions = USER_ROLES;

const scopeOptions = SCOPE_TYPES;

const statusFilterOptions = [
  { label: "전체", value: "all" },
  { label: "대기 중", value: "pending" },
  { label: "수락 완료", value: "accepted" },
  { label: "취소됨", value: "revoked" },
] as const;

type StatusFilter = (typeof statusFilterOptions)[number]["value"];

export type RecentInvitation = {
  id: string;
  invited_email: string;
  invited_role: UserRole;
  scope_type: ScopeType;
  scope_id?: string | null;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type InvitationCounts = Record<StatusFilter, number>;

type InvitationSuccess = {
  invitation_id: string;
  invitation_url: string;
  expires_at: string;
};

type InvitationError = {
  code: string;
  message: string;
};

type InvitationResponse =
  | {
      ok: true;
      data: InvitationSuccess;
    }
  | {
      ok: false;
      error: InvitationError;
    };

type RevokeInvitationResponse =
  | {
      ok: true;
      data: {
        invitation_id: string;
        status: InvitationStatus;
      };
    }
  | {
      ok: false;
      error: InvitationError;
    };

type AdminInvitationsClientProps = {
  recentInvitations: RecentInvitation[];
  counts: InvitationCounts;
  loadError: string | null;
  initialStatus: StatusFilter;
  initialSearch: string;
};

function displayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "-";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
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

function formatStatus(status: InvitationStatus) {
  if (status === "pending") {
    return "대기 중";
  }

  if (status === "accepted") {
    return "수락 완료";
  }

  if (status === "revoked") {
    return "취소됨";
  }

  return status;
}

function normalizeSearchForQuery(value: string) {
  return value.trim().slice(0, 100);
}

export function AdminInvitationsClient({
  recentInvitations,
  counts,
  loadError,
  initialStatus,
  initialSearch,
}: AdminInvitationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitedRole, setInvitedRole] = useState<UserRole>("coachee");
  const [scopeType, setScopeType] = useState<ScopeType>("global");
  const [scopeId, setScopeId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isBulkRevoking, setIsBulkRevoking] = useState(false);
  const [success, setSuccess] = useState<InvitationSuccess | null>(null);
  const [error, setError] = useState<InvitationError | null>(null);
  const [revokeSuccessMessage, setRevokeSuccessMessage] = useState("");
  const [revokeError, setRevokeError] = useState<InvitationError | null>(null);
  const [reinviteMessage, setReinviteMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const visiblePendingInvitations = useMemo(() => {
    return recentInvitations.filter(
      (invitation) => invitation.status === "pending",
    );
  }, [recentInvitations]);

  function pushListQuery(nextStatus: StatusFilter, nextSearch: string) {
    const params = new URLSearchParams();
    const normalizedSearch = normalizeSearchForQuery(nextSearch);

    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    if (normalizedSearch.length > 0) {
      params.set("search", normalizedSearch);
    }

    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname);
  }

  async function handleSubmit() {
    const normalizedEmail = normalizeText(invitedEmail).toLowerCase();
    const normalizedScopeId =
      scopeType === "global" ? null : normalizeText(scopeId);
    const expiresInDaysNumber = Number(expiresInDays);

    if (!isValidEmail(normalizedEmail)) {
      setSuccess(null);
      setError({
        code: "INVALID_EMAIL",
        message: isNonEmptyString(normalizedEmail)
          ? "올바른 이메일 형식이 아닙니다."
          : "이메일을 입력해 주세요.",
      });
      return;
    }

    if (scopeType !== "global" && !isValidUuid(normalizedScopeId)) {
      setSuccess(null);
      setError({
        code: "INVALID_SCOPE_ID",
        message: "범위 ID는 올바른 UUID여야 합니다.",
      });
      return;
    }

    if (!isValidNumberInRange(expiresInDaysNumber, 1, 30)) {
      setSuccess(null);
      setError({
        code: "INVALID_EXPIRES_IN_DAYS",
        message: "만료 기간은 1일부터 30일 사이로 입력해 주세요.",
      });
      return;
    }

    setIsSubmitting(true);
    setSuccess(null);
    setError(null);
    setRevokeError(null);
    setRevokeSuccessMessage("");
    setReinviteMessage("");
    setCopyMessage("");

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invited_email: normalizedEmail,
          invited_role: invitedRole,
          scope_type: scopeType,
          scope_id: normalizedScopeId,
          expires_in_days: expiresInDaysNumber,
        }),
      });

      const result = (await response.json()) as InvitationResponse;

      if (result.ok) {
        setSuccess(result.data);
        setInvitedEmail("");
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (caughtError) {
      setError({
        code: "REQUEST_FAILED",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "초대 생성 요청 중 예상하지 못한 오류가 발생했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function revokeInvitation(invitationId: string) {
    const response = await fetch("/api/invitations/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invitation_id: invitationId,
      }),
    });

    return (await response.json()) as RevokeInvitationResponse;
  }

  async function handleRevoke(invitationId: string) {
    const invitation = recentInvitations.find(
      (recentInvitation) => recentInvitation.id === invitationId,
    );
    const confirmed = window.confirm(
      `초대를 취소하시겠습니까?\n\n대상: ${
        invitation?.invited_email ?? invitationId
      }\n이 작업은 되돌릴 수 없습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setRevokingId(invitationId);
    setRevokeError(null);
    setRevokeSuccessMessage("");
    setReinviteMessage("");

    try {
      const result = await revokeInvitation(invitationId);

      if (result.ok) {
        setRevokeSuccessMessage("초대를 취소했습니다.");
        router.refresh();
      } else {
        setRevokeError(result.error);
      }
    } catch (caughtError) {
      setRevokeError({
        code: "REQUEST_FAILED",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "초대 취소 요청 중 예상하지 못한 오류가 발생했습니다.",
      });
    } finally {
      setRevokingId(null);
    }
  }

  async function handleBulkRevoke() {
    if (visiblePendingInvitations.length === 0 || isBulkRevoking) {
      return;
    }

    const confirmed = window.confirm(
      `대기 중인 초대를 모두 취소하시겠습니까?\n\n대상: ${visiblePendingInvitations.length}건\n이 작업은 되돌릴 수 없습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setIsBulkRevoking(true);
    setRevokeError(null);
    setRevokeSuccessMessage("");
    setReinviteMessage("");

    try {
      for (const invitation of visiblePendingInvitations) {
        const result = await revokeInvitation(invitation.id);

        if (!result.ok) {
          setRevokeError(result.error);
          return;
        }
      }

      setRevokeSuccessMessage("대기 중 초대를 취소했습니다.");
      router.refresh();
    } catch (caughtError) {
      setRevokeError({
        code: "REQUEST_FAILED",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "일괄 취소 요청 중 예상하지 못한 오류가 발생했습니다.",
      });
    } finally {
      setIsBulkRevoking(false);
    }
  }

  function handleReinvite(invitation: RecentInvitation) {
    setInvitedEmail(invitation.invited_email);
    setInvitedRole(invitation.invited_role);
    setScopeType(invitation.scope_type);
    setScopeId(
      invitation.scope_type === "global" ? "" : invitation.scope_id ?? "",
    );
    setSuccess(null);
    setError(null);
    setCopyMessage("");
    setRevokeError(null);
    setRevokeSuccessMessage("");
    setReinviteMessage(
      "같은 조건의 대기 중 초대가 이미 있습니다. 먼저 해당 초대를 취소한 뒤 새 초대를 생성하세요.",
    );
  }

  async function copyInvitationUrl() {
    if (!success?.invitation_url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(success.invitation_url);
      setCopyMessage("복사되었습니다.");
    } catch {
      setCopyMessage(
        "복사에 실패했습니다. 링크를 직접 선택해 복사해 주세요.",
      );
    }
  }

  return (
    <div className="mt-8 grid gap-8">
      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">새 사용자 초대</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              invited_email
            </span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
              onChange={(event) => setInvitedEmail(event.target.value)}
              placeholder="newuser@example.com"
              type="email"
              value={invitedEmail}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              invited_role
            </span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
              onChange={(event) =>
                setInvitedRole(event.target.value as UserRole)
              }
              value={invitedRole}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              scope_type
            </span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
              onChange={(event) => {
                setScopeType(event.target.value as ScopeType);
                if (event.target.value === "global") {
                  setScopeId("");
                }
              }}
              value={scopeType}
            >
              {scopeOptions.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">scope_id</span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal disabled:bg-slate-100 disabled:text-slate-500"
              disabled={scopeType === "global"}
              onChange={(event) => setScopeId(event.target.value)}
              placeholder={
                scopeType === "global"
                  ? "global이면 비워둡니다."
                  : "해당 scope의 UUID"
              }
              value={scopeType === "global" ? "" : scopeId}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              expires_in_days
            </span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
              max="30"
              min="1"
              onChange={(event) => setExpiresInDays(event.target.value)}
              type="number"
              value={expiresInDays}
            />
          </label>
        </div>

        <button
          className="mt-6 rounded-md bg-slate-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting}
          onClick={handleSubmit}
          type="button"
        >
          {isSubmitting ? "초대 생성 중..." : "초대 생성"}
        </button>

        {success && (
          <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <p className="font-semibold">초대가 생성되었습니다.</p>
            <p className="mt-2 text-sm">
              생성된 링크를 복사해서 전달해 주세요. 최근 목록은 자동으로
              새로고침됩니다.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                className="break-all text-sm font-medium underline"
                href={success.invitation_url}
              >
                {success.invitation_url}
              </a>
              <button
                className="shrink-0 rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium"
                onClick={copyInvitationUrl}
                type="button"
              >
                복사
              </button>
            </div>
            {copyMessage && <p className="mt-2 text-sm">{copyMessage}</p>}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-semibold">초대 생성 실패</p>
            <p className="mt-2 text-sm">error.code: {error.code}</p>
            <p className="mt-1 text-sm">error.message: {error.message}</p>
          </div>
        )}

        {reinviteMessage && (
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">재초대 준비 완료</p>
            <p className="mt-2 text-sm">{reinviteMessage}</p>
          </div>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">최근 초대 목록</h2>

        {loadError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            최근 초대 목록을 불러오지 못했습니다. {loadError}
          </div>
        )}

        {revokeSuccessMessage && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            {revokeSuccessMessage}
          </div>
        )}

        {revokeError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-semibold">초대 취소 실패</p>
            <p className="mt-2 text-sm">error.code: {revokeError.code}</p>
            <p className="mt-1 text-sm">
              error.message: {revokeError.message}
            </p>
          </div>
        )}

        {!loadError && (
          <div className="mt-5 grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {statusFilterOptions.map((option) => {
                const isSelected = initialStatus === option.value;

                return (
                  <button
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                      isSelected
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    key={option.value}
                    onClick={() => pushListQuery(option.value, initialSearch)}
                    type="button"
                  >
                    {option.label} {counts[option.value]}
                  </button>
                );
              })}

              <button
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                disabled={
                  visiblePendingInvitations.length === 0 || isBulkRevoking
                }
                onClick={handleBulkRevoke}
                type="button"
              >
                {isBulkRevoking
                  ? "대기 중 초대 일괄 취소 중..."
                  : "대기 중 초대 일괄 취소"}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="이메일 검색"
                type="text"
                value={searchInput}
              />
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => pushListQuery(initialStatus, searchInput)}
                type="button"
              >
                검색
              </button>
              {searchInput.length > 0 && (
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setSearchInput("");
                    pushListQuery(initialStatus, "");
                  }}
                  type="button"
                >
                  검색 초기화
                </button>
              )}
            </div>
          </div>
        )}

        {!loadError && recentInvitations.length === 0 && (
          <p className="mt-4 text-slate-600">표시할 초대가 없습니다.</p>
        )}

        {!loadError && recentInvitations.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 pr-4 font-medium">invited_email</th>
                  <th className="py-3 pr-4 font-medium">invited_role</th>
                  <th className="py-3 pr-4 font-medium">scope_type</th>
                  <th className="py-3 pr-4 font-medium">status</th>
                  <th className="py-3 pr-4 font-medium">expires_at</th>
                  <th className="py-3 pr-4 font-medium">accepted_at</th>
                  <th className="py-3 pr-4 font-medium">created_at</th>
                  <th className="py-3 pr-4 font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {recentInvitations.map((invitation) => (
                  <tr
                    className="border-b border-slate-100 text-slate-800"
                    key={invitation.id}
                  >
                    <td className="py-3 pr-4">
                      {displayValue(invitation.invited_email)}
                    </td>
                    <td className="py-3 pr-4">
                      {displayValue(invitation.invited_role)}
                    </td>
                    <td className="py-3 pr-4">
                      {displayValue(invitation.scope_type)}
                    </td>
                    <td className="py-3 pr-4">
                      {formatStatus(invitation.status)}
                    </td>
                    <td className="py-3 pr-4">
                      {formatDateTime(invitation.expires_at)}
                    </td>
                    <td className="py-3 pr-4">
                      {formatDateTime(invitation.accepted_at)}
                    </td>
                    <td className="py-3 pr-4">
                      {formatDateTime(invitation.created_at)}
                    </td>
                    <td className="py-3 pr-4">
                      {invitation.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => handleReinvite(invitation)}
                            type="button"
                          >
                            재초대 준비
                          </button>
                          <button
                            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                            disabled={
                              revokingId === invitation.id || isBulkRevoking
                            }
                            onClick={() => handleRevoke(invitation.id)}
                            type="button"
                          >
                            {revokingId === invitation.id
                              ? "취소 중..."
                              : "취소"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
