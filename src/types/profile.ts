export type SafeProfile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  primary_role: string | null;
  growth_level_id: string | null;
  generation_number: number | null;
  status: string;
  preferred_language: string | null;
  timezone: string | null;
  country_id: string | null;
  region_id: string | null;
  organization_id: string | null;
  church_id: string | null;
  group_id: string | null;
  cohort_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SelfUpdatePayload = {
  display_name?: string | null;
  phone?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
};

export type ActiveRoleSlim = {
  id: string;
  role: string;
  scope_type: string;
  scope_id: string | null;
  granted_at: string;
  expires_at: string | null;
};

export type MeResponse = {
  profile: SafeProfile;
  roles: ActiveRoleSlim[];
};

export const PROFILE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  ARCHIVED: "archived",
  ANONYMIZED: "anonymized",
} as const;

export type ProfileStatus =
  (typeof PROFILE_STATUS)[keyof typeof PROFILE_STATUS];
