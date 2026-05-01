// =============================================================================
// src/lib/auth/getSession.ts
// Resolves the current Supabase session on the server.
// Use in Route Handlers and Server Components to get the authenticated user.
//
// Returns a typed result — no thrown exceptions, callers handle the error case.
//
// Why getUser() instead of getSession():
//   getSession() reads the session from the cookie and trusts it without
//   re-validating the JWT against the Supabase Auth server.
//   getUser() makes a network call to re-validate — more secure for server-
//   side code where the request may arrive with a tampered cookie.
// =============================================================================

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { GetSessionResult } from '@/types/auth'

export async function getSession(): Promise<GetSessionResult> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return { user: null, error: error?.message ?? 'No authenticated user' }
  }

  return { user: data.user, error: null }
}
