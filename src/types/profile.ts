import type {
  ProfileRow,
  ProfileStatus,
  ScopeType,
  UserRole,
} from "@/types/database";

export type SafeProfile = Pick<
  ProfileRow,
  | "id"
  | "full_name"
  | "display_name"
  | "email"
  | "phone"
  | "primary_role"
  | "growth_level_id"
  | "generation_number"
  | "status"
  | "preferred_language"
  | "timezone"
  | "country_id"
  | "region_id"
  | "organization_id"
  | "church_id"
  | "ministry_position"
  | "group_id"
  | "cohort_id"
  | "created_at"
  | "updated_at"
>;

export type SelfUpdatePayload = {
  display_name?: string | null;
  phone?: string | null;
  ministry_position?: string | null;
};

export type ActiveRoleSlim = {
  id: string;
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  granted_at: string;
  expires_at: string | null;
};

export type MeResponse = {
  profile: SafeProfile;
  roles: ActiveRoleSlim[];
};

export const PROFILE_STATUS: Record<Uppercase<ProfileStatus>, ProfileStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  ARCHIVED: "archived",
  ANONYMIZED: "anonymized",
};
