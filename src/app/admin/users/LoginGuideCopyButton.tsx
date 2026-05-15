"use client";

import { useState } from "react";
import { Button, TextareaInput } from "@/components/ui";

type LoginGuideCopyButtonProps = {
  email: string | null;
};

function buildLoginGuide(email: string) {
  const origin =
    typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;

  return `GO Coaching 로그인 안내입니다.

로그인 주소: ${origin}/login
아이디: ${email}

비밀번호를 모르시는 경우 관리자에게 임시 비밀번호 재설정을 요청해 주세요.
처음 로그인하신 후에는 비밀번호를 변경해 주세요.`;
}

export function LoginGuideCopyButton({ email }: LoginGuideCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const normalizedEmail = email?.trim() ?? "";

  async function handleCopy() {
    if (!normalizedEmail) {
      return;
    }

    const guideText = buildLoginGuide(normalizedEmail);

    try {
      await navigator.clipboard.writeText(guideText);
      setFallbackText(null);
      setCopied(true);
    } catch {
      setCopied(false);
      setFallbackText(guideText);
    }
  }

  if (!normalizedEmail) {
    return <span className="text-sm text-slate-400">이메일 없음</span>;
  }

  return (
    <div className="grid gap-2">
      <Button icon="report" onClick={handleCopy} size="sm" type="button" variant="secondary">
        로그인 안내 복사
      </Button>
      {copied ? (
        <p className="text-xs text-emerald-700">로그인 안내문이 복사되었습니다.</p>
      ) : null}
      {fallbackText ? (
        <label className="grid gap-1 text-xs text-slate-600">
          <span>복사에 실패했습니다. 아래 안내문을 수동으로 복사해 주세요.</span>
          <TextareaInput
            className="min-h-32 text-xs"
            readOnly
            value={fallbackText}
          />
        </label>
      ) : null}
    </div>
  );
}
