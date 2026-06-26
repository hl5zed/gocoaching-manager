import type { UserRole } from "../../types/database";

export const COACH_ROUTE_ROLES: UserRole[] = [
  "coach",
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
];

export const COACH_MAKER_ROUTE_ROLES: UserRole[] = [
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
];

export const ADMIN_ROUTE_ROLES: UserRole[] = [
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
];

export const SUPER_ADMIN_ROUTE_ROLES: UserRole[] = ["super_admin"];

export function isPublicRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/unauthorized" ||
    pathname === "/password-reset" ||
    pathname === "/password-reset/confirm" ||
    pathname === "/api/invitations/accept"
  );
}

export function isApiRoute(pathname: string) {
  return pathname.startsWith("/api/");
}

export function isProtectedPageRoute(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/my-coaching/") ||
    pathname === "/my-coaching" ||
    pathname.startsWith("/coach/") ||
    pathname === "/coach" ||
    pathname.startsWith("/coach-maker/") ||
    pathname === "/coach-maker" ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin" ||
    pathname.startsWith("/super-admin/") ||
    pathname === "/super-admin" ||
    pathname.startsWith("/profile/") ||
    pathname === "/profile" ||
    pathname.startsWith("/coachee/") ||
    pathname === "/coachee"
  );
}

export function getAllowedRolesForPath(pathname: string): UserRole[] | null {
  if (pathname.startsWith("/super-admin/") || pathname === "/super-admin") {
    return SUPER_ADMIN_ROUTE_ROLES;
  }

  if (pathname.startsWith("/admin/") || pathname === "/admin") {
    return ADMIN_ROUTE_ROLES;
  }

  if (pathname.startsWith("/coach/") || pathname === "/coach") {
    return COACH_ROUTE_ROLES;
  }

  if (pathname.startsWith("/coach-maker/") || pathname === "/coach-maker") {
    return COACH_MAKER_ROUTE_ROLES;
  }

  if (pathname.startsWith("/api/admin/")) {
    return ADMIN_ROUTE_ROLES;
  }

  if (pathname.startsWith("/api/coach-maker/")) {
    return COACH_MAKER_ROUTE_ROLES;
  }

  return null;
}

/** middleware auth.getUser()만 필요 — profile/status/locale 조회 생략 */
export function isAuthOnlyApiRoute(pathname: string) {
  return pathname.startsWith("/api/i18n/");
}

export type MiddlewareAuthRequirement =
  | "auth_only"
  | "profile"
  | "role_gate";

/**
 * null — 인증 불필요(공개·미매칭).
 * auth_only — 세션만 검증.
 * profile — profile + disabled 차단(페이지·profile API).
 * role_gate — profile + user_roles + 역할 허용 목록.
 */
export function getMiddlewareAuthRequirement(
  pathname: string,
): MiddlewareAuthRequirement | null {
  if (isPublicRoute(pathname)) {
    return null;
  }

  if (!isProtectedPageRoute(pathname) && !isApiRoute(pathname)) {
    return null;
  }

  if (getAllowedRolesForPath(pathname)) {
    return "role_gate";
  }

  if (isAuthOnlyApiRoute(pathname)) {
    return "auth_only";
  }

  return "profile";
}
