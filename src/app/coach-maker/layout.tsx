import type { ReactNode } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import type { SidebarNavSection } from "@/components/layout/SidebarNav";
import { ADMIN_NAV, ADMIN_NAV_ROLES } from "@/components/layout/adminNav";
import { CoachShellActions } from "@/components/layout/CoachShellActions";
import { getVerifiedRolesFromHeaders } from "@/lib/auth/get-user-roles";

const COACH_MAKER_NAV: SidebarNavSection[] = [
  {
    title: "코치메이커",
    items: [
      { href: "/coach-maker", label: "코치메이커 현황", icon: "dashboard", exact: true },
      {
        href: "/coach-maker/moksilgi-progress",
        label: "전체 목실기 성취",
        icon: "report",
      },
      { href: "/my-coaching/moksilgi", label: "나의 목실기", icon: "report" },
      { href: "/my-coaching/records", label: "나의 기록", icon: "dashboard" },
    ],
  },
  {
    title: "계정",
    items: [{ href: "/profile", label: "내 프로필", icon: "settings" }],
  },
];

export default async function CoachMakerLayout({
  children,
}: {
  children: ReactNode;
}) {
  // /coach-maker는 role-gated 경로라 미들웨어가 set한 헤더에서 role을 읽는다(추가 DB 조회 없음).
  // 헤더가 없으면 안전 기본값(coach_maker 전용 네비)으로 처리한다.
  const verifiedRoles = await getVerifiedRolesFromHeaders();
  const isAdmin = (verifiedRoles ?? []).some((role) =>
    ADMIN_NAV_ROLES.includes(role),
  );

  return (
    <ShellLayout
      homeHref={isAdmin ? "/admin" : "/dashboard"}
      navSections={isAdmin ? ADMIN_NAV : COACH_MAKER_NAV}
      topbarActions={<CoachShellActions />}
    >
      {children}
    </ShellLayout>
  );
}
