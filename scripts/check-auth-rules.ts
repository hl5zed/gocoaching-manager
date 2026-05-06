const {
  ADMIN_ROUTE_ROLES,
  COACH_ROUTE_ROLES,
  SUPER_ADMIN_ROUTE_ROLES,
  getAllowedRolesForPath,
  isApiRoute,
  isProtectedPageRoute,
  isPublicRoute,
} = require("../src/lib/auth/route-access.ts") as typeof import("../src/lib/auth/route-access");
const {
  getDashboardQuickLinksState,
} = require("../src/lib/dashboard/quick-links.ts") as typeof import("../src/lib/dashboard/quick-links");

function ensure(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureDeepEqual(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

function runChecks() {
  ensure(isPublicRoute("/login") === true, "/login should stay public");
  ensure(isPublicRoute("/signup") === true, "/signup should stay public");
  ensure(
    isPublicRoute("/unauthorized") === true,
    "/unauthorized should stay public",
  );
  ensure(
    isPublicRoute("/api/invitations/accept") === true,
    "/api/invitations/accept should stay public",
  );
  ensure(isPublicRoute("/dashboard") === false, "/dashboard should not be public");

  ensure(
    isProtectedPageRoute("/dashboard") === true,
    "/dashboard should stay protected",
  );
  ensure(
    isProtectedPageRoute("/dashboard/weekly") === true,
    "/dashboard/* should stay protected",
  );
  ensure(isProtectedPageRoute("/coach") === true, "/coach should stay protected");
  ensure(
    isProtectedPageRoute("/coach/queue") === true,
    "/coach/* should stay protected",
  );
  ensure(isProtectedPageRoute("/admin") === true, "/admin should stay protected");
  ensure(
    isProtectedPageRoute("/admin/users") === true,
    "/admin/* should stay protected",
  );
  ensure(
    isProtectedPageRoute("/super-admin") === true,
    "/super-admin should stay protected",
  );
  ensure(
    isProtectedPageRoute("/profile") === false,
    "/profile should not be classified as middleware-protected page rule here",
  );

  ensure(isApiRoute("/api/me") === true, "/api/me should stay an API route");
  ensure(
    isApiRoute("/api/admin/invitations") === true,
    "/api/admin/invitations should stay an API route",
  );
  ensure(isApiRoute("/dashboard") === false, "/dashboard is not an API route");

  ensureDeepEqual(
    getAllowedRolesForPath("/admin/users"),
    ADMIN_ROUTE_ROLES,
    "admin allowed roles drifted",
  );
  ensureDeepEqual(
    getAllowedRolesForPath("/coach"),
    COACH_ROUTE_ROLES,
    "coach allowed roles drifted",
  );
  ensureDeepEqual(
    getAllowedRolesForPath("/super-admin/settings"),
    SUPER_ADMIN_ROUTE_ROLES,
    "super-admin allowed roles drifted",
  );
  ensure(
    getAllowedRolesForPath("/dashboard") === null,
    "/dashboard should not require a role list",
  );

  const adminState = getDashboardQuickLinksState(["super_admin"]);
  ensure(adminState.showAdminUsers === true, "admin users link should show");
  ensure(
    adminState.showAdminInvitations === true,
    "admin invitations link should show",
  );
  ensure(adminState.showCoachLink === false, "admin should not imply coach link");
  ensure(
    adminState.showCoacheeMessage === false,
    "admin should not imply coachee message",
  );
  ensure(
    adminState.showNoRoleMessage === false,
    "admin should not show no-role message",
  );

  const coachState = getDashboardQuickLinksState(["coach"]);
  ensure(coachState.showAdminUsers === false, "coach should not show admin users");
  ensure(
    coachState.showAdminInvitations === false,
    "coach should not show admin invitations",
  );
  ensure(coachState.showCoachLink === true, "coach link should show");
  ensure(
    coachState.showCoacheeMessage === false,
    "coach should not show coachee message",
  );
  ensure(
    coachState.showNoRoleMessage === false,
    "coach should not show no-role message",
  );

  const coacheeState = getDashboardQuickLinksState(["coachee"]);
  ensure(
    coacheeState.showAdminUsers === false,
    "coachee should not show admin users",
  );
  ensure(
    coacheeState.showAdminInvitations === false,
    "coachee should not show admin invitations",
  );
  ensure(coacheeState.showCoachLink === false, "coachee should not show coach link");
  ensure(
    coacheeState.showCoacheeMessage === true,
    "coachee message should show",
  );
  ensure(
    coacheeState.showNoRoleMessage === false,
    "coachee should not show no-role message",
  );

  const noRoleState = getDashboardQuickLinksState([]);
  ensure(noRoleState.showAdminUsers === false, "no-role should not show admin users");
  ensure(
    noRoleState.showAdminInvitations === false,
    "no-role should not show admin invitations",
  );
  ensure(noRoleState.showCoachLink === false, "no-role should not show coach link");
  ensure(
    noRoleState.showCoacheeMessage === false,
    "no-role should not show coachee message",
  );
  ensure(
    noRoleState.showNoRoleMessage === true,
    "no-role message should show",
  );
}

runChecks();
console.log("Auth and dashboard rule checks passed.");

export {};
