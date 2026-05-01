// =============================================================================
// src/types/roles.ts
// Role and scope domain types — placeholder-safe manual definitions.
// Constants mirror DB enums for client-side use without DB round-trips.
//
// Why no Pick<UserRoleRow, ...>:
//   Before `supabase gen types typescript` is run, UserRoleRow resolves to
//   `never` because the placeholder Database has no tables defined.
//   Pick<never, Keys> may cause typecheck errors.
// =============================================================================

// ---------------------------------------------------------------------------
// Active role — a user_roles row known to be currently active.
// Used in permission checks on the client.
// ---------------------------------------------------------------------------
export type ActiveRole = {
  id: string
  profile_id: string
  role: string
  scope_type: string
  scope_id: string | null
  granted_at: string
  expires_at: string | null
}

// ---------------------------------------------------------------------------
// System role constants — mirrors system_role_enum.
// `satisfies` is intentionally omitted while supabase.ts is still a placeholder.
// ---------------------------------------------------------------------------
export const SYSTEM_ROLE = {
  SUPER_ADMIN:        'super_admin',
  COUNTRY_ADMIN:      'country_admin',
  ORGANIZATION_ADMIN: 'organization_admin',
  CHURCH_ADMIN:       'church_admin',
  GROUP_LEADER:       'group_leader',
  COACH_MAKER:        'coach_maker',
  COACH:              'coach',
  COACHEE:            'coachee',
} as const

export type SystemRole =
  typeof SYSTEM_ROLE[keyof typeof SYSTEM_ROLE]

// ---------------------------------------------------------------------------
// Scope type constants — mirrors scope_type_enum.
// `satisfies` is intentionally omitted while supabase.ts is still a placeholder.
// ---------------------------------------------------------------------------
export const SCOPE_TYPE = {
  GLOBAL:       'global',
  COUNTRY:      'country',
  REGION:       'region',
  ORGANIZATION: 'organization',
  CHURCH:       'church',
  GROUP:        'group',
  COHORT:       'cohort',
  COACH:        'coach',
} as const

export type ScopeType =
  typeof SCOPE_TYPE[keyof typeof SCOPE_TYPE]

// ---------------------------------------------------------------------------
// Simple client-side permission helper type
// Used to pass resolved permissions to components without re-querying DB.
// ---------------------------------------------------------------------------
export type ResolvedPermissions = {
  isSuperAdmin: boolean
  roles: ActiveRole[]
}