import type { ScopeType, UserRole } from "@/types/database";

export type ActiveRole = {
  id: string;
  profile_id: string;
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  granted_at: string;
  expires_at: string | null;
};

export const SYSTEM_ROLE: Record<Uppercase<UserRole>, UserRole> = {
  SUPER_ADMIN: "super_admin",
  COUNTRY_ADMIN: "country_admin",
  ORGANIZATION_ADMIN: "organization_admin",
  CHURCH_ADMIN: "church_admin",
  GROUP_LEADER: "group_leader",
  COACH_MAKER: "coach_maker",
  COACH: "coach",
  COACHEE: "coachee",
};

export type SystemRole = UserRole;

export const SCOPE_TYPE: Record<Uppercase<ScopeType>, ScopeType> = {
  GLOBAL: "global",
  COUNTRY: "country",
  REGION: "region",
  ORGANIZATION: "organization",
  CHURCH: "church",
  GROUP: "group",
  COHORT: "cohort",
  COACH: "coach",
};

export type ScopeTypeValue = ScopeType;

export type ResolvedPermissions = {
  isSuperAdmin: boolean;
  roles: ActiveRole[];
};
