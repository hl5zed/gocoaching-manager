import type { ReactNode } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import type { SidebarNavSection } from "@/components/layout/SidebarNav";
import { CoachShellActions } from "@/components/layout/CoachShellActions";

const COACH_NAV: SidebarNavSection[] = [
  {
    title: "코치 작업공간",
    items: [
      { href: "/coach", label: "대시보드", icon: "dashboard", exact: true },
      { href: "/coach/relationships", label: "코칭 관계", icon: "users" },
      { href: "/coach/weekly-logs", label: "기록 현황", icon: "report" },
      { href: "/coach/moksilgi", label: "목실기", icon: "report" },
    ],
  },
  {
    title: "계정",
    items: [
      { href: "/coach/profile", label: "내 프로필", icon: "settings", exact: true },
      { href: "/coach/profile/edit", label: "프로필 수정", icon: "settings" },
    ],
  },
];

export default function CoachLayout({ children }: { children: ReactNode }) {
  return (
    <ShellLayout
      homeHref="/coach"
      navSections={COACH_NAV}
      topbarActions={<CoachShellActions />}
    >
      {children}
    </ShellLayout>
  );
}
