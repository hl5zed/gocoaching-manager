"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "verifying" | "ready" | "submitting" | "success" | "error" | "invalid";

export function PasswordResetConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    const code = searchParams.get("code");

    async function verifyToken() {
      const supabase = createSupabaseBrowserClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus("invalid");
          return;
        }
        setStatus("ready");
        return;
      }

      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error) {
          setStatus("invalid");
          return;
        }
        setStatus("ready");
        return;
      }

      setStatus("invalid");
    }

    verifyToken();
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setStatus("submitting");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("ready");
      setErrorMessage("비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.");
      return;
    }

    setStatus("success");
    setTimeout(() => {
      router.replace("/dashboard");
    }, 2000);
  }

  if (status === "verifying") {
    return (
      <div className="mt-8 text-center text-ink-muted">링크를 확인하는 중...</div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="mt-8 rounded-card border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-700">링크가 유효하지 않습니다</p>
        <p className="mt-2 text-sm text-red-600">
          링크가 만료되었거나 이미 사용되었습니다.
        </p>
        <a
          className="mt-4 inline-block font-medium text-brand-600 underline"
          href="/password-reset"
        >
          다시 요청하기
        </a>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="mt-8 rounded-card border border-line-base bg-surface-card p-6 text-center">
        <p className="text-lg font-semibold text-ink-strong">
          비밀번호가 변경되었습니다
        </p>
        <p className="mt-2 text-sm text-ink-muted">잠시 후 대시보드로 이동합니다.</p>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="block text-sm font-medium text-ink-base"
          htmlFor="password"
        >
          새 비밀번호
        </label>
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600 disabled:opacity-50"
          disabled={status === "submitting"}
          id="password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="8자 이상"
          required
          type="password"
          value={password}
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium text-ink-base"
          htmlFor="confirm-password"
        >
          새 비밀번호 확인
        </label>
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600 disabled:opacity-50"
          disabled={status === "submitting"}
          id="confirm-password"
          minLength={8}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="비밀번호를 다시 입력하세요"
          required
          type="password"
          value={confirmPassword}
        />
      </div>

      {errorMessage && (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <button
        className="w-full rounded-control bg-navy-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={status === "submitting"}
        type="submit"
      >
        {status === "submitting" ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
