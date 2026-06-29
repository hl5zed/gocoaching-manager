"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/useI18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function CoacheeTopBar() {
  const router = useRouter();
  const { t } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsSigningOut(false);
      window.alert(
        error.message || t("auth.signOutFailed", "로그아웃하지 못했습니다."),
      );
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      aria-label="코치이 상단 메뉴"
      className="print:hidden sticky top-0 z-40 border-b border-line-base bg-surface-app/95 px-4 py-2 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-ink-strong">
          {t("nav.myCoachingSpace", "내 코칭 공간")}
        </p>
        <nav
          aria-label="상위 메뉴"
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <ButtonLink href="/dashboard" icon="dashboard" size="sm">
            {t("nav.dashboard", "나의 홈")}
          </ButtonLink>
          <LanguageSwitcher />
          <Button
            disabled={isSigningOut}
            icon="logout"
            onClick={handleSignOut}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isSigningOut
              ? t("auth.signingOut", "로그아웃 중...")
              : t("auth.signOut", "로그아웃")}
          </Button>
        </nav>
      </div>
    </header>
  );
}
