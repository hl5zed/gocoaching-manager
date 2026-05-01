import type { Database } from "./supabase";

export type { Database };

type PublicTables = Database["public"]["Tables"];
type PublicEnums = Database["public"]["Enums"];

export type Tables<T extends string> =
  T extends keyof PublicTables
    ? PublicTables[T] extends { Row: infer R }
      ? R
      : never
    : never;

export type InsertDto<T extends string> =
  T extends keyof PublicTables
    ? PublicTables[T] extends { Insert: infer I }
      ? I
      : never
    : never;

export type UpdateDto<T extends string> =
  T extends keyof PublicTables
    ? PublicTables[T] extends { Update: infer U }
      ? U
      : never
    : never;

export type Enums<T extends string> = T extends keyof PublicEnums
  ? PublicEnums[T]
  : never;

export type ProfileRow = Tables<"profiles">;
export type UserRoleRow = Tables<"user_roles">;
export type InvitationRow = Tables<"invitations">;
export type AuditLogRow = Tables<"audit_logs">;
export type SupportedLanguageRow = Tables<"supported_languages">;
export type TranslationNamespaceRow = Tables<"translation_namespaces">;
export type TranslationKeyRow = Tables<"translation_keys">;
export type TranslationValueRow = Tables<"translation_values">;
export type GrowthLevelRow = Tables<"growth_levels">;
export type CountryRow = Tables<"countries">;
export type RegionRow = Tables<"regions">;
export type OrganizationRow = Tables<"organizations">;
export type ChurchRow = Tables<"churches">;
export type GroupRow = Tables<"groups">;
export type CohortRow = Tables<"cohorts">;

export type ProfileInsert = InsertDto<"profiles">;
export type ProfileUpdate = UpdateDto<"profiles">;
export type UserRoleInsert = InsertDto<"user_roles">;
export type AuditLogInsert = InsertDto<"audit_logs">;
export type InvitationInsert = InsertDto<"invitations">;
export type TranslationValueInsert = InsertDto<"translation_values">;
export type TranslationValueUpdate = UpdateDto<"translation_values">;

export type ProfileStatusEnum = Enums<"profile_status_enum">;
export type SystemRoleEnum = Enums<"system_role_enum">;
export type ScopeTypeEnum = Enums<"scope_type_enum">;
export type UserRoleStatusEnum = Enums<"user_role_status_enum">;
export type AuditActionEnum = Enums<"audit_action_enum">;
export type InvitationStatusEnum = Enums<"invitation_status_enum">;
export type TranslationReviewStatusEnum = Enums<"translation_review_status_enum">;
export type RiskLevelEnum = Enums<"risk_level_enum">;
