import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_ROUTE_ROLES,
  COACH_ROUTE_ROLES,
  SUPER_ADMIN_ROUTE_ROLES,
  getAllowedRolesForPath,
  isApiRoute,
  isProtectedPageRoute,
  isPublicRoute,
} from "@/lib/auth/route-access";
import { getDashboardQuickLinksState } from "@/lib/dashboard/quick-links";

test("public route exceptions stay public", () => {
  assert.equal(isPublicRoute("/login"), true);
  assert.equal(isPublicRoute("/signup"), true);
  assert.equal(isPublicRoute("/unauthorized"), true);
  assert.equal(isPublicRoute("/api/invitations/accept"), true);
  assert.equal(isPublicRoute("/dashboard"), false);
});

test("protected page route detection matches current app rules", () => {
  assert.equal(isProtectedPageRoute("/dashboard"), true);
  assert.equal(isProtectedPageRoute("/dashboard/weekly"), true);
  assert.equal(isProtectedPageRoute("/coach"), true);
  assert.equal(isProtectedPageRoute("/coach/queue"), true);
  assert.equal(isProtectedPageRoute("/admin"), true);
  assert.equal(isProtectedPageRoute("/admin/users"), true);
  assert.equal(isProtectedPageRoute("/super-admin"), true);
  assert.equal(isProtectedPageRoute("/profile"), false);
});

test("api route detection treats all /api paths as api routes", () => {
  assert.equal(isApiRoute("/api/me"), true);
  assert.equal(isApiRoute("/api/admin/invitations"), true);
  assert.equal(isApiRoute("/dashboard"), false);
});

test("allowed roles for route groups stay aligned with middleware rules", () => {
  assert.deepEqual(getAllowedRolesForPath("/admin/users"), ADMIN_ROUTE_ROLES);
  assert.deepEqual(getAllowedRolesForPath("/coach"), COACH_ROUTE_ROLES);
  assert.deepEqual(
    getAllowedRolesForPath("/super-admin/settings"),
    SUPER_ADMIN_ROUTE_ROLES,
  );
  assert.equal(getAllowedRolesForPath("/dashboard"), null);
});

test("dashboard quick links show admin links for admin roles", () => {
  const state = getDashboardQuickLinksState(["super_admin"]);

  assert.equal(state.showAdminUsers, true);
  assert.equal(state.showAdminInvitations, true);
  assert.equal(state.showCoachLink, false);
  assert.equal(state.showCoacheeMessage, false);
  assert.equal(state.showNoRoleMessage, false);
});

test("dashboard quick links show coach link for coach roles", () => {
  const state = getDashboardQuickLinksState(["coach"]);

  assert.equal(state.showAdminUsers, false);
  assert.equal(state.showAdminInvitations, false);
  assert.equal(state.showCoachLink, true);
  assert.equal(state.showCoacheeMessage, false);
  assert.equal(state.showNoRoleMessage, false);
});

test("dashboard quick links show coachee message for coachee role", () => {
  const state = getDashboardQuickLinksState(["coachee"]);

  assert.equal(state.showAdminUsers, false);
  assert.equal(state.showAdminInvitations, false);
  assert.equal(state.showCoachLink, false);
  assert.equal(state.showCoacheeMessage, true);
  assert.equal(state.showNoRoleMessage, false);
});

test("dashboard quick links show no-role message when no active roles exist", () => {
  const state = getDashboardQuickLinksState([]);

  assert.equal(state.showAdminUsers, false);
  assert.equal(state.showAdminInvitations, false);
  assert.equal(state.showCoachLink, false);
  assert.equal(state.showCoacheeMessage, false);
  assert.equal(state.showNoRoleMessage, true);
});
