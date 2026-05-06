import type { UserRole } from "@/types/database";

export function hasRole(userRoles: UserRole[], allowed: UserRole[]) {
  return userRoles.some((role) => allowed.includes(role));
}
