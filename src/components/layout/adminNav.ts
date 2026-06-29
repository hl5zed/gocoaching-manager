import type { UserRole } from "@/types/database";
import type { SidebarNavSection } from "./SidebarNav";

/** 관리자 콘솔 사이드바를 보는 role (admin 콘솔 접근 권한과 동일 기준) */
export const ADMIN_NAV_ROLES: UserRole[] = [
  "super_admin",
  "country_admin",
  "organization_admin",
  "church_admin",
];

export const ADMIN_NAV: SidebarNavSection[] = [
  {
    title: "관리",
    items: [
      { href: "/admin", label: "개요", icon: "dashboard", exact: true },
      { href: "/admin/users", label: "회원·역할", icon: "users" },
      { href: "/admin/invitations", label: "초대 관리", icon: "report" },
      { href: "/admin/coaching-genealogy", label: "코칭 관계", icon: "users" },
      { href: "/coach-maker", label: "코치메이커 현황", icon: "report" },
    ],
  },
  {
    title: "계정",
    items: [{ href: "/profile", label: "내 프로필", icon: "settings" }],
  },
];
