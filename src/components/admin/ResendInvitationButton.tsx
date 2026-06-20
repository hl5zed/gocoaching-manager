"use client";

import { useState } from "react";
import type { InvitationStatus, ScopeType, UserRole } from "@/types/database";

type ResendInvitationButtonProps = {
  invitationId: string;
};

type ResendInvitationResponse =
  | {
      ok: true;
      data: {
        invitation_id: string;
        email: string;
        invited_role: UserRole;
        scope_type: ScopeType;
        scope_id: string | null;
        expires_at: string;
        status: InvitationStatus;
        invitationUrl: string;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export function ResendInvitationButton({
  invitationId,
}: ResendInvitationButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  async function handleClick() {
    const confirmed = window.confirm(
      "이 초대의 새 링크를 생성하시겠습니까?",
    );

    if (!confirmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessUrl(null);
    setCopyMessage("");

    try {
      const response = await fetch(
        `/api/admin/invitations/${encodeURIComponent(invitationId)}/resend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expires_in_days: 7 }),
        },
      );

      const result = (await response.json()) as ResendInvitationResponse;

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setSuccessUrl(result.data.invitationUrl);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "지금 초대 링크를 다시 생성할 수 없습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!successUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(successUrl);
      setCopyMessage("복사되었습니다.");
    } catch {
      setCopyMessage("복사하지 못했습니다. 링크를 직접 복사해 주세요.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        className="rounded-control border border-sky-300 px-3 py-1.5 text-sm font-medium text-sky-700 disabled:cursor-not-allowed disabled:border-line-base disabled:text-ink-faint"
        disabled={isSubmitting}
        onClick={handleClick}
        type="button"
      >
        {isSubmitting ? "생성 중..." : "링크 재생성"}
      </button>

      {successUrl && (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sky-900">
          <p className="text-xs font-medium">
            지금 이 링크를 복사해 주세요. 보안을 위해 원본 토큰은 다시 표시되지 않습니다.
          </p>
          <a className="mt-2 block break-all text-xs underline" href={successUrl}>
            {successUrl}
          </a>
          <button
            className="mt-2 rounded-control border border-sky-300 px-2 py-1 text-xs font-medium"
            onClick={handleCopy}
            type="button"
          >
            복사
          </button>
          {copyMessage && <p className="mt-1 text-xs">{copyMessage}</p>}
        </div>
      )}

      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
