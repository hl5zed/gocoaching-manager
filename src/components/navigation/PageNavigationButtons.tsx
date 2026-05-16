"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/useI18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PageNavigationButtonsProps = {
  backHref?: string;
  backLabel?: string;
  className?: string;
  dashboardHref?: string;
  showForward?: boolean;
};

const navButtonClassName =
  "h-10 min-h-10 min-w-[112px] rounded-xl px-4 py-2 text-sm";

export function PageNavigationButtons({
  backHref,
  backLabel,
  className = "",
  dashboardHref = "/dashboard",
  showForward = false,
}: PageNavigationButtonsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const homeLabel =
    dashboardHref === "/admin"
      ? t("nav.adminCenter", "관리자 센터")
      : t("nav.dashboard", "나의 홈");

  function handleForward() {
    if (typeof window !== "undefined") {
      window.history.forward();
    }
  }

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
    <nav
      aria-label="페이지 이동"
      className={`flex flex-wrap items-center gap-2 text-sm ${className}`}
    >
      {backHref ? (
        <ButtonLink
          className={navButtonClassName}
          href={backHref}
          icon="arrow-left"
          size="sm"
        >
          {backLabel ?? t("common.previous", "이전 화면")}
        </ButtonLink>
      ) : (
        <Button
          className={navButtonClassName}
          icon="arrow-left"
          onClick={() => router.back()}
          size="sm"
          type="button"
        >
          {backLabel ?? t("common.previous", "이전 화면")}
        </Button>
      )}
      {showForward ? (
        <Button
          className={navButtonClassName}
          icon="arrow-right"
          iconPosition="right"
          onClick={handleForward}
          size="sm"
          type="button"
        >
          {t("common.next", "다음 화면")}
        </Button>
      ) : null}
      <ButtonLink
        className={navButtonClassName}
        href={dashboardHref}
        icon="dashboard"
        size="sm"
      >
        {homeLabel}
      </ButtonLink>
      <LanguageSwitcher />
      <Button
        className={navButtonClassName}
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
  );
}
