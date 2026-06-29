import type { ReactNode } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import type { SidebarNavSection } from "@/components/layout/SidebarNav";
import { ADMIN_NAV, ADMIN_NAV_ROLES } from "@/components/layout/adminNav";
import { CoachShellActions } from "@/components/layout/CoachShellActions";
import { getSession } from "@/lib/auth/getSession";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PROFILE_NAV: SidebarNavSection[] = [
  {
    title: "계정",
    items: [
      { href: "/profile", label: "내 프로필", icon: "settings", exact: true },
      { href: "/profile/edit", label: "프로필 수정", icon: "settings" },
    ],
  },
  {
    title: "내비게이션",
    items: [{ href: "/dashboard", label: "대시보드", icon: "dashboard" }],
  },
];

export default async function ProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  // /profile은 role-gated 경로가 아니라 헤더에 role이 없다.
  // admin이면 관리자 콘솔 사이드바를 유지하기 위해 role을 1회 조회한다.
  // 조회 실패/비 admin이면 기본 프로필 네비(기존 동작)로 둔다.
  const session = await getSession();
  let isAdmin = false;

  if (session.user) {
    try {
      const supabase = await createSupabaseServerClient();
      const roles = await getUserRoles(supabase, session.user.id);
      isAdmin = roles.some((role) => ADMIN_NAV_ROLES.includes(role));
    } catch {
      isAdmin = false;
    }
  }

  return (
    <ShellLayout
      homeHref={isAdmin ? "/admin" : "/dashboard"}
      navSections={isAdmin ? ADMIN_NAV : PROFILE_NAV}
      topbarActions={<CoachShellActions />}
    >
      {children}
    </ShellLayout>
  );
}
