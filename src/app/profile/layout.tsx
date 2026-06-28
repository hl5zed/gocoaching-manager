import type { ReactNode } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import type { SidebarNavSection } from "@/components/layout/SidebarNav";
import { CoachShellActions } from "@/components/layout/CoachShellActions";

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
    items: [
      { href: "/dashboard", label: "대시보드", icon: "dashboard" },
    ],
  },
];

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <ShellLayout
      homeHref="/dashboard"
      navSections={PROFILE_NAV}
      topbarActions={<CoachShellActions />}
    >
      {children}
    </ShellLayout>
  );
}
