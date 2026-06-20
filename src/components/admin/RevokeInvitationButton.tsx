"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RevokeInvitationButtonProps = {
  invitationId: string;
};

type RevokeInvitationResponse =
  | {
      ok: true;
      data: {
        invitation_id: string;
        status: string;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export function RevokeInvitationButton({
  invitationId,
}: RevokeInvitationButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      "이 대기 중 초대를 취소하시겠습니까?",
    );

    if (!confirmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/invitations/${encodeURIComponent(invitationId)}/revoke`,
        {
          method: "POST",
        },
      );

      const result = (await response.json()) as RevokeInvitationResponse;

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "지금 초대를 취소할 수 없습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        className="rounded-control border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:border-line-base disabled:text-ink-faint"
        disabled={isSubmitting}
        onClick={handleClick}
        type="button"
      >
        {isSubmitting ? "취소 중..." : "취소"}
      </button>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
