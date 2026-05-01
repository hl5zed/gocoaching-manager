// =============================================================================
// src/types/database.ts
// Convenience aliases over the generated Database type.
// Import row types from here rather than directly from supabase.ts so that
// when the generated file is regenerated, call-sites do not need updating.
//
// Helper generic types (Tables<>, InsertDto<>, etc.) are defined here, NOT in
// supabase.ts, so they are never overwritten by `supabase gen types typescript`.
// =============================================================================

import type { Database } from './supabase'

// Re-export the root type for creating typed Supabase clients
export type { Database }

// ---------------------------------------------------------------------------
// Helper generic types — defined here so regenerating supabase.ts never
// removes them. These mirror the helpers the Supabase CLI generates but
// placing them here keeps them stable across regenerations.
// ---------------------------------------------------------------------------

type PublicTables = Database['public']['Tables']
type PublicEnums  = Database['public']['Enums']

// Row: the full SELECT shape of a table.
// T extends string (not keyof PublicTables) so that aliases like
// Tables<'profiles'> are accepted by the compiler while supabase.ts is still
// a placeholder (where PublicTables = Record<string, never>, making
// keyof PublicTables = never). The inner conditional checks T extends keyof
// PublicTables to resolve to the real Row type once types are generated,
// and falls through to never in placeholder mode.
export type Tables<T extends string> =
  T extends keyof PublicTables
    ? PublicTables[T] extends { Row: infer R } ? R : never
    : never

// InsertDto: the INSERT payload shape (optional fields have defaults).
export type InsertDto<T extends string> =
  T extends keyof PublicTables
    ? PublicTables[T] extends { Insert: infer I } ? I : never
    : never

// UpdateDto: the UPDATE payload shape (all fields optional).
export type UpdateDto<T extends string> =
  T extends keyof PublicTables
    ? PublicTables[T] extends { Update: infer U } ? U : never
    : never

// Enums: resolves a DB enum name to its TypeScript union type.
export type Enums<T extends string> =
  T extends keyof PublicEnums
    ? PublicEnums[T]
    : never

// ---------------------------------------------------------------------------
// Row types — one per table
// These resolve to `never` until supabase gen types is run. That is expected
// and intentional: the placeholder schema has no tables defined.
// ---------------------------------------------------------------------------
export type ProfileRow              = Tables<'profiles'>
export type UserRoleRow             = Tables<'user_roles'>
export type InvitationRow           = Tables<'invitations'>
export type AuditLogRow             = Tables<'audit_logs'>
export type SupportedLanguageRow    = Tables<'supported_languages'>
export type TranslationNamespaceRow = Tables<'translation_namespaces'>
export type TranslationKeyRow       = Tables<'translation_keys'>
export type TranslationValueRow     = Tables<'translation_values'>
export type GrowthLevelRow          = Tables<'growth_levels'>
export type CountryRow              = Tables<'countries'>
export type RegionRow               = Tables<'regions'>
export type OrganizationRow         = Tables<'organizations'>
export type ChurchRow               = Tables<'churches'>
export type GroupRow                = Tables<'groups'>
export type CohortRow               = Tables<'cohorts'>

// ---------------------------------------------------------------------------
// Insert / Update DTO types
// ---------------------------------------------------------------------------
export type ProfileInsert           = InsertDto<'profiles'>
export type ProfileUpdate           = UpdateDto<'profiles'>
export type UserRoleInsert          = InsertDto<'user_roles'>
export type AuditLogInsert          = InsertDto<'audit_logs'>
export type InvitationInsert        = InsertDto<'invitations'>
export type TranslationValueInsert  = InsertDto<'translation_values'>
export type TranslationValueUpdate  = UpdateDto<'translation_values'>

// ---------------------------------------------------------------------------
// Enum types
// These resolve to `never` until supabase gen types is run.
// ---------------------------------------------------------------------------
export type ProfileStatusEnum           = Enums<'profile_status_enum'>
export type SystemRoleEnum              = Enums<'system_role_enum'>
export type ScopeTypeEnum               = Enums<'scope_type_enum'>
export type UserRoleStatusEnum          = Enums<'user_role_status_enum'>
export type AuditActionEnum             = Enums<'audit_action_enum'>
export type InvitationStatusEnum        = Enums<'invitation_status_enum'>
export type TranslationReviewStatusEnum = Enums<'translation_review_status_enum'>
export type RiskLevelEnum               = Enums<'risk_level_enum'>
