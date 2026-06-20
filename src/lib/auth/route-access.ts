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
    pathname === "/super-admin"
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

  return null;
}
