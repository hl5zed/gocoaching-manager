import type { UserRole } from "../../types/database";

const adminQuickLinkRoles: UserRole[] = [
  "super_admin",
  "country_admin",
  "organization_admin",
  "church_admin",
];

const coachQuickLinkRoles: UserRole[] = ["coach", "coach_maker"];

export type DashboardQuickLinksState = {
  showAdminUsers: boolean;
  showAdminInvitations: boolean;
  showCoachLink: boolean;
  showMyCoachingLink: boolean;
  showCoacheeMessage: boolean;
  showNoRoleMessage: boolean;
};

function hasAnyRole(userRoles: UserRole[], allowed: UserRole[]) {
  return userRoles.some((role) => allowed.includes(role));
}

export function getDashboardQuickLinksState(
  userRoles: UserRole[],
): DashboardQuickLinksState {
  const hasAdminAccess = hasAnyRole(userRoles, adminQuickLinkRoles);
  const hasCoachAccess = hasAnyRole(userRoles, coachQuickLinkRoles);
  const hasCoacheeRole = userRoles.includes("coachee");
  const hasAnyAssignedRole = userRoles.length > 0;

  return {
    showAdminUsers: hasAdminAccess,
    showAdminInvitations: hasAdminAccess,
    showCoachLink: hasCoachAccess,
    showMyCoachingLink: hasCoacheeRole,
    showCoacheeMessage: false,
    showNoRoleMessage: !hasAnyAssignedRole,
  };
}
