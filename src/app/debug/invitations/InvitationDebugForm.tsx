"use client";

import { useState } from "react";

const roleOptions = [
  "super_admin",
  "country_admin",
  "organization_admin",
  "church_admin",
  "group_leader",
  "coach_maker",
  "coach",
  "coachee",
];

const scopeOptions = [
  "global",
  "country",
  "region",
  "organization",
  "church",
  "group",
  "cohort",
  "coach",
];

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

export function InvitationDebugForm() {
  const [invitedEmail, setInvitedEmail] = useState("newuser@example.com");
  const [invitedRole, setInvitedRole] = useState("coachee");
  const [scopeType, setScopeType] = useState("global");
  const [scopeId, setScopeId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<InvitationSuccess | null>(null);
  const [error, setError] = useState<InvitationError | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invited_email: invitedEmail,
          invited_role: invitedRole,
          scope_type: scopeType,
          scope_id: scopeId.trim() ? scopeId.trim() : null,
          expires_in_days: Number(expiresInDays),
        }),
      });

      const result = (await response.json()) as InvitationResponse;

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
            : "초대 생성 요청 중 알 수 없는 오류가 발생했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        개발 테스트용 페이지입니다. 실제 운영 화면이 아니라 API 동작 확인을
        쉽게 하기 위한 임시 도구입니다.
      </div>

      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">
            invited_email
          </span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            value={invitedEmail}
            onChange={(event) => setInvitedEmail(event.target.value)}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">
            invited_role
          </span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={invitedRole}
            onChange={(event) => setInvitedRole(event.target.value)}
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
            className="rounded-md border border-slate-300 px-3 py-2"
            value={scopeType}
            onChange={(event) => setScopeType(event.target.value)}
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
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="global이면 비워두세요"
            value={scopeId}
            onChange={(event) => setScopeId(event.target.value)}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">
            expires_in_days
          </span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            min="1"
            max="30"
            type="number"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
          />
        </label>
      </div>

      <button
        className="rounded-md bg-slate-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isSubmitting}
        type="button"
        onClick={handleSubmit}
      >
        {isSubmitting ? "초대 생성 중..." : "초대 생성 테스트"}
      </button>

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="font-semibold">초대 생성 성공</p>
          <p className="mt-2 text-sm">invitation_url</p>
          <a
            className="mt-1 block break-all text-sm font-medium underline"
            href={success.invitation_url}
          >
            {success.invitation_url}
          </a>
          <p className="mt-3 text-sm">expires_at: {success.expires_at}</p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">초대 생성 실패</p>
          <p className="mt-2 text-sm">error.code: {error.code}</p>
          <p className="mt-1 text-sm">error.message: {error.message}</p>
        </div>
      )}
    </div>
  );
}
