"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SCOPE_TYPES,
  USER_ROLES,
  type InvitationStatus,
  type ScopeType,
  type UserRole,
} from "@/types/database";
import { getRoleLabel, getScopeTypeLabel } from "@/lib/ui/labels";

type CreateInvitationSuccess = {
  invitation_id: string;
  email: string;
  invited_role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  expires_at: string;
  status: InvitationStatus;
  invitationUrl: string;
  emailDelivery?:
    | {
        sent: true;
      }
    | {
        sent: false;
        code: "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED";
        message: string;
      };
};

type CreateInvitationError = {
  code: string;
  message: string;
};

type CreateInvitationResponse =
  | {
      ok: true;
      data: CreateInvitationSuccess;
    }
  | {
      ok: false;
      error: CreateInvitationError;
    };

export function AdminInvitationCreateForm() {
  const [email, setEmail] = useState("");
  const [invitedRole, setInvitedRole] = useState<UserRole>("coachee");
  const [scopeType, setScopeType] = useState<ScopeType>("global");
  const [scopeId, setScopeId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendEmailNow, setSendEmailNow] = useState(true);
  const [success, setSuccess] = useState<CreateInvitationSuccess | null>(null);
  const [error, setError] = useState<CreateInvitationError | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  const normalizedScopeId = useMemo(() => {
    return scopeType === "global" ? null : scopeId.trim() || null;
  }, [scopeId, scopeType]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);
    setCopyMessage("");

    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          invited_role: invitedRole,
          scope_type: scopeType,
          scope_id: normalizedScopeId,
          expires_in_days: Number(expiresInDays),
          send_email: sendEmailNow,
        }),
      });

      const result = (await response.json()) as CreateInvitationResponse;

      if (result.ok) {
        setSuccess(result.data);
      } else {
        setError(result.error);
      }
    } catch (caughtError) {
      setError({
        code: "REQUEST_FAILED",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "지금 초대를 생성할 수 없습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyInvitationUrl() {
    if (!success?.invitationUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(success.invitationUrl);
      setCopyMessage("복사했습니다.");
    } catch {
      setCopyMessage("복사하지 못했습니다. 링크를 직접 복사해 주세요.");
    }
  }

  return (
    <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">이메일</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="newuser@example.com"
            type="email"
            value={email}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">초대 역할</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
            onChange={(event) => setInvitedRole(event.target.value as UserRole)}
            value={invitedRole}
          >
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {getRoleLabel(role)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">범위 유형</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
            onChange={(event) => {
              const nextScopeType = event.target.value as ScopeType;
              setScopeType(nextScopeType);

              if (nextScopeType === "global") {
                setScopeId("");
              }
            }}
            value={scopeType}
          >
            {SCOPE_TYPES.map((scope) => (
              <option key={scope} value={scope}>
                {getScopeTypeLabel(scope)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">범위 ID</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal disabled:bg-slate-100 disabled:text-slate-500"
            disabled={scopeType === "global"}
            onChange={(event) => setScopeId(event.target.value)}
            placeholder={
              scopeType === "global"
                ? "전체 범위에서는 사용하지 않습니다"
                : "범위 UUID"
            }
            type="text"
            value={scopeType === "global" ? "" : scopeId}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">만료 기간</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
            onChange={(event) => setExpiresInDays(event.target.value)}
            value={expiresInDays}
          >
            <option value="7">7일</option>
            <option value="14">14일</option>
            <option value="30">30일</option>
          </select>
        </label>

        <label className="flex items-center gap-3 md:col-span-2">
          <input
            checked={sendEmailNow}
            className="h-4 w-4 rounded border-slate-300"
            onChange={(event) => setSendEmailNow(event.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-medium text-slate-700">
            지금 초대 이메일 보내기
          </span>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          className="rounded-md bg-slate-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting}
          onClick={handleSubmit}
          type="button"
        >
          {isSubmitting ? "생성 중..." : "초대 생성"}
        </button>

        <Link
          className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700"
          href="/admin/invitations"
        >
          초대 목록으로 돌아가기
        </Link>
      </div>

      {success && (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="font-semibold">초대를 생성했습니다.</p>
          <p className="mt-2 text-sm">
            지금 이 링크를 복사해 주세요. 보안을 위해 원본 토큰은 다시
            표시되지 않습니다.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <a
              className="break-all text-sm font-medium underline"
              href={success.invitationUrl}
            >
              {success.invitationUrl}
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
          {success.emailDelivery?.sent === true && (
            <p className="mt-2 text-sm">이메일을 보냈습니다.</p>
          )}
          {success.emailDelivery?.sent === false &&
            success.emailDelivery.code === "EMAIL_NOT_CONFIGURED" && (
              <p className="mt-2 text-sm">
                이메일 설정이 없습니다. 링크를 직접 복사해 주세요.
              </p>
            )}
          {success.emailDelivery?.sent === false &&
            success.emailDelivery.code === "EMAIL_SEND_FAILED" && (
              <p className="mt-2 text-sm">
                이메일 전송에 실패했습니다. 링크를 직접 복사해 주세요.
              </p>
            )}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">초대 생성에 실패했습니다.</p>
          <p className="mt-2 text-sm">{error.message}</p>
        </div>
      )}
    </section>
  );
}
