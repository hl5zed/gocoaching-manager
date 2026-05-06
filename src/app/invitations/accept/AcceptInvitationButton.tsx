"use client";

import Link from "next/link";
import { useState } from "react";

type AcceptInvitationButtonProps = {
  token: string;
};

type AcceptInvitationResponse =
  | {
      ok: true;
      data?: {
        message?: string;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export function AcceptInvitationButton({ token }: AcceptInvitationButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAccept() {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const result = (await response.json()) as AcceptInvitationResponse;

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.ok === false
            ? result.error.message
            : "초대 수락 중 오류가 발생했습니다.",
        );
        return;
      }

      setSuccessMessage("초대를 수락했습니다.");
    } catch {
      setErrorMessage("초대 수락 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <button
        className="rounded-md bg-slate-950 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isSubmitting}
        onClick={handleAccept}
        type="button"
      >
        {isSubmitting ? "수락 중..." : "초대 수락"}
      </button>

      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <p>{successMessage}</p>
          <Link className="mt-2 inline-block underline" href="/dashboard">
            대시보드로 이동
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
