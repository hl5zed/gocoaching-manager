"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "idle" | "submitting" | "success" | "error";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/password-reset/confirm`
        : "/password-reset/confirm";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setStatus("error");
      setErrorMessage("이메일 발송에 실패했습니다. 다시 시도해 주세요.");
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-card border border-line-base bg-surface-card p-6 text-center">
        <p className="text-lg font-semibold text-ink-strong">이메일이 발송되었습니다</p>
        <p className="mt-2 text-sm text-ink-muted">
          <span className="font-medium text-ink-base">{email}</span> 으로 비밀번호
          재설정 링크를 보냈습니다. 받은 편지함을 확인해 주세요.
        </p>
        <p className="mt-4 text-sm text-ink-faint">
          이메일이 오지 않으면 스팸 폴더를 확인하거나, 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="block text-sm font-medium text-ink-base"
          htmlFor="email"
        >
          이메일
        </label>
        <input
          autoComplete="email"
          className="mt-2 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600 disabled:opacity-50"
          disabled={status === "submitting"}
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      {status === "error" && errorMessage && (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <button
        className="w-full rounded-control bg-navy-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={status === "submitting"}
        type="submit"
      >
        {status === "submitting" ? "발송 중..." : "재설정 이메일 보내기"}
      </button>

      <p className="text-center text-sm text-ink-faint">
        <a className="font-medium text-brand-600 underline" href="/login">
          로그인으로 돌아가기
        </a>
      </p>
    </form>
  );
}
