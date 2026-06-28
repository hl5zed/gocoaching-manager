"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/useI18n";

export function CoachShellActions() {
  const router = useRouter();
  const { t } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setIsSigningOut(false);
      window.alert(error.message || t("auth.signOutFailed", "로그아웃하지 못했습니다."));
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher />
      <Button
        disabled={isSigningOut}
        icon="logout"
        onClick={handleSignOut}
        size="sm"
        type="button"
        variant="ghost"
      >
        {isSigningOut ? t("auth.signingOut", "로그아웃 중...") : t("auth.signOut", "로그아웃")}
      </Button>
    </div>
  );
}
