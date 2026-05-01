// =============================================================================
// src/types/profile.ts
// Profile domain types — placeholder-safe manual definitions.
//
// Why no Pick<ProfileRow, ...> or Pick<UserRoleRow, ...>:
//   Before `supabase gen types typescript` is run, ProfileRow and UserRoleRow
//   both resolve to `never` (the placeholder Database has no tables defined).
//   Pick<never, Keys> is rejected by TypeScript because keyof never = never
//   and the key union cannot satisfy that constraint.
//
//   All types here are defined as plain object types so that:
//   - typecheck passes with the placeholder supabase.ts in place
//   - the shapes are explicit and readable without generated types
//   - after supabase gen types is run, these remain valid as-is
//
// TODO after `supabase gen types`:
//   SafeProfile and SelfUpdatePayload may optionally be changed to
//   Pick<ProfileRow, ...> to get exact column types from the generated schema.
//   The current explicit form is also correct and does not require that change.
// =============================================================================

// ---------------------------------------------------------------------------
// SafeProfile — fields returned to the authenticated user from GET /api/me.
//
// Excluded fields (never returned to the client directly):
//   auth_user_id        — internal auth link, not for client consumption
//   anonymized_at       — internal compliance field
//   anonymized_by       — internal compliance field
//   erasure_requested_at — internal compliance field
//   parent_coach_id     — returned by coaching endpoints, not profile endpoint
//   promoted_by         — returned by growth level endpoints
//   growth_level_updated_at — returned by growth level endpoints
//   deleted_at          — internal soft-delete field
// ---------------------------------------------------------------------------
export type SafeProfile = {
  id:               string
  full_name:        string | null
  display_name:     string | null
  email:            string | null
  phone:            string | null
  primary_role:     string | null
  growth_level_id:  string | null
  generation_number: number | null
  status:           string
  preferred_language: string | null
  timezone:         string | null
  country_id:       string | null
  region_id:        string | null
  organization_id:  string | null
  church_id:        string | null
  group_id:         string | null
  cohort_id:        string | null
  created_at:       string
  updated_at:       string
}

// ---------------------------------------------------------------------------
// SelfUpdatePayload — the only fields a user may update via PATCH /api/me.
// All other fields are admin-only or managed by service_role workflows.
// Enforced server-side in updateProfile.ts; validated with Zod in the route.
// ---------------------------------------------------------------------------
export type SelfUpdatePayload = {
  display_name?:      string | null
  phone?:             string | null
  preferred_language?: string | null
  timezone?:          string | null
}

// ---------------------------------------------------------------------------
// ActiveRoleSlim — the role fields returned inside MeResponse.
// Defined here rather than imported from roles.ts to avoid the same
// Pick<UserRoleRow, ...> problem while the placeholder is in place.
// ---------------------------------------------------------------------------
export type ActiveRoleSlim = {
  id:         string
  role:       string
  scope_type: string
  scope_id:   string | null
  granted_at: string
  expires_at: string | null
}

// ---------------------------------------------------------------------------
// GET /api/me response shape
// ---------------------------------------------------------------------------
export type MeResponse = {
  profile: SafeProfile
  roles:   ActiveRoleSlim[]
}

// ---------------------------------------------------------------------------
// Profile status constants — mirrors profile_status_enum for client use.
// `satisfies` is intentionally omitted: the placeholder Database resolves
// ProfileStatusEnum to `never`, which would cause a typecheck error before
// `supabase gen types` is run. Once types are generated, `satisfies` can
// be restored as: } as const satisfies Record<string, ProfileStatusEnum>
// ---------------------------------------------------------------------------
export const PROFILE_STATUS = {
  ACTIVE:     'active',
  INACTIVE:   'inactive',
  SUSPENDED:  'suspended',
  ARCHIVED:   'archived',
  ANONYMIZED: 'anonymized',
} as const

export type ProfileStatus =
  typeof PROFILE_STATUS[keyof typeof PROFILE_STATUS]
