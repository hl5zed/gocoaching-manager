export type ActiveRole = {
  id: string;
  profile_id: string;
  role: string;
  scope_type: string;
  scope_id: string | null;
  granted_at: string;
  expires_at: string | null;
};

export const SYSTEM_ROLE = {
  SUPER_ADMIN: "super_admin",
  COUNTRY_ADMIN: "country_admin",
  ORGANIZATION_ADMIN: "organization_admin",
  CHURCH_ADMIN: "church_admin",
  GROUP_LEADER: "group_leader",
  COACH_MAKER: "coach_maker",
  COACH: "coach",
  COACHEE: "coachee",
} as const;

export type SystemRole = (typeof SYSTEM_ROLE)[keyof typeof SYSTEM_ROLE];

export const SCOPE_TYPE = {
  GLOBAL: "global",
  COUNTRY: "country",
  REGION: "region",
  ORGANIZATION: "organization",
  CHURCH: "church",
  GROUP: "group",
  COHORT: "cohort",
  COACH: "coach",
} as const;

export type ScopeType = (typeof SCOPE_TYPE)[keyof typeof SCOPE_TYPE];

export type ResolvedPermissions = {
  isSuperAdmin: boolean;
  roles: ActiveRole[];
};
